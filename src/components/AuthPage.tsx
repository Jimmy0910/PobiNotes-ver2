import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { LogIn, UserPlus, Key, User, ShieldCheck } from 'lucide-react';
import logoUrl from '../assets/logo.png';

interface AuthPageProps {
  onLoginSuccess: (user: { id: string; username: string; is_admin: number }) => void;
}

export default function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerAsAdmin, setRegisterAsAdmin] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { username, password }
        });
        onLoginSuccess(res.user);
      } else {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: { username, password, ...(registerAsAdmin ? { registerAsAdmin: true } : {}) }
        });
        setSuccess('註冊成功！請直接登入。');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || '發生錯誤，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '85vh',
      padding: '30px 16px'
    }} className="animate-fade-in">
      <div className="hardcover-book-wrapper">
        <div className="hardcover-book">
          {/* Cover decorative elements */}
          <div className="cover-stitched-frame" />
          <div className="book-corner-brass book-corner-tr" />
          <div className="book-corner-brass book-corner-br" />
          <div className="book-ribbon-tag" title="PobiNotes 書籤" />

          {/* Hardcover Embossed Title & Mascot */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '20px',
            position: 'relative',
            zIndex: 6
          }}>
            <div style={{
              padding: '6px',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(212, 175, 55, 0.5)',
              marginBottom: '10px'
            }}>
              <img 
                src={logoUrl} 
                alt="PobiNotes Logo" 
                style={{
                  width: '90px',
                  height: '90px',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '0.04em',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.8)',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>PobiNotes-線上錯題本</span>
            </h2>
            <div style={{
              color: '#A5D6A7',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
            }}>
              活頁錯題診斷・學習成長手帳
            </div>
          </div>

          {/* Bookplate Insertion Page (溫潤米黃藏書票/內頁插頁) */}
          <div className="bookplate-insert washi-tape-strip">
            <div style={{
              textAlign: 'center',
              marginBottom: '18px',
              paddingBottom: '10px',
              borderBottom: '1px dashed #D4C9BA'
            }}>
              <h3 style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#001F65',
                marginBottom: '4px'
              }}>
                {isLogin ? '歡迎翻開錯題本' : '建立專屬錯題本'}
              </h3>
              <p style={{ color: '#4A586E', fontSize: '0.82rem' }}>
                {isLogin ? '請登入您的帳戶，翻閱您的錯題紀錄' : '立即剪貼註冊，開始建立知識資料庫'}
              </p>
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2',
                border: '1px solid #EF4444',
                color: '#991B1B',
                padding: '10px 12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: '#DCFCE7',
                border: '1px solid #22C55E',
                color: '#14532D',
                padding: '10px 12px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                fontWeight: 500
              }}>
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ color: '#001F65', fontWeight: 700, fontSize: '0.82rem' }}>
                  使用者名稱
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B'
                  }}>
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    className="input"
                    style={{
                      paddingLeft: '38px',
                      height: '42px',
                      background: '#FFFFFF',
                      borderColor: '#D4C9BA',
                      color: '#001F65',
                      fontWeight: 500
                    }}
                    placeholder="請輸入使用者名稱"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ color: '#001F65', fontWeight: 700, fontSize: '0.82rem' }}>
                  密碼
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748B'
                  }}>
                    <Key size={16} />
                  </span>
                  <input
                    type="password"
                    className="input"
                    style={{
                      paddingLeft: '38px',
                      height: '42px',
                      background: '#FFFFFF',
                      borderColor: '#D4C9BA',
                      color: '#001F65',
                      fontWeight: 500
                    }}
                    placeholder={isLogin ? "請輸入密碼" : "設定 6 位數以上密碼"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '10px',
                  height: '44px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  boxShadow: '0 4px 12px rgba(0, 31, 101, 0.28)'
                }}
                disabled={loading}
              >
                {loading ? '處理中...' : (
                  isLogin ? (
                    <>登入 <LogIn size={16} /></>
                  ) : (
                    <>註冊 <UserPlus size={16} /></>
                  )
                )}
              </button>
            </form>

            <div style={{
              marginTop: '18px',
              textAlign: 'center',
              fontSize: '0.84rem',
              color: '#475569'
            }}>
              {isLogin ? '還沒有帳號嗎？' : '已經有帳號了？'}
              <button
                type="button"
                className="btn-text"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#001F65',
                  cursor: 'pointer',
                  fontWeight: '700',
                  marginLeft: '4px',
                  textDecoration: 'underline'
                }}
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                  setRegisterAsAdmin(false);
                }}
                disabled={loading}
              >
                {isLogin ? '立即註冊' : '前往登入'}
              </button>
            </div>

            {/* Admin Registration Toggle */}
            {!isLogin && (
              <div style={{
                marginTop: '10px',
                textAlign: 'center',
                fontSize: '0.8rem',
              }}>
                <button
                  type="button"
                  onClick={() => setRegisterAsAdmin(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: registerAsAdmin ? '#197A27' : '#64748B',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: registerAsAdmin ? 700 : 500,
                    transition: 'color 0.2s'
                  }}
                  disabled={loading}
                >
                  <ShieldCheck size={13} />
                  {registerAsAdmin ? '✓ 將以管理員身份註冊' : '以管理員身份註冊'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
