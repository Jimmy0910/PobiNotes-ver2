import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../utils/api';
import { compressImage } from '../utils/compress';
import type { CategoriesBundle, Field, FieldOption, MistakeRecord } from '../types';
import { getEffectiveFamiliarityId, isLegacyMasteryField } from '../types';
import { Save, X, Image as ImageIcon, Loader2, Tag, Plus } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  fields: {
    questionFields: Field[];
    answerFields: Field[];
  };
}

interface MistakeEditorProps {
  categories: CategoriesBundle;
  initialSubjectId?: string | null;
  chapterId: string | null;
  initialUnitId?: string | null;
  mistake: MistakeRecord | null; // Null means create new
  onClose: () => void;
  onSaveSuccess: () => void;
  onRefreshCategories?: () => Promise<void>;
  onImageClick?: (src: string) => void;
}

export default function MistakeEditor({
  categories,
  initialSubjectId = null,
  chapterId,
  initialUnitId = null,
  mistake,
  onClose,
  onSaveSuccess,
  onImageClick
}: MistakeEditorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Core metadata fields (Requirement 5)
  const [title, setTitle] = useState('');
  const [mistakeDate, setMistakeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subjectId, setSubjectId] = useState<string>('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [familiarityId, setFamiliarityId] = useState<string>('');
  const [errorReasonIds, setErrorReasonIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Error reason scope filter & menu selection states (Global / Specific Subject / Specific Chapter)
  const [errorFilterScope, setErrorFilterScope] = useState<'auto' | 'global' | 'subject' | 'chapter'>('auto');
  const [errorFilterSubjectId, setErrorFilterSubjectId] = useState<string>('');
  const [errorFilterChapterId, setErrorFilterChapterId] = useState<string>('');

  // Template dynamic fields data
  const [questionData, setQuestionData] = useState<{ [fieldId: string]: any }>({});
  const [answerData, setAnswerData] = useState<{ [fieldId: string]: any }>({});

  const [uploadingFields, setUploadingFields] = useState<{ [fieldId: string]: boolean }>({});
  const [loading, setLoading] = useState(false);

  const normalizeOptions = (options: any[] | undefined): FieldOption[] => {
    if (!options || !Array.isArray(options)) return [];
    return options
      .filter(opt => opt !== null && opt !== undefined)
      .map(opt => {
        if (typeof opt === 'string') {
          return { value: opt, color: 'default' };
        }
        return {
          value: opt.value || '',
          color: opt.color || 'default'
        };
      });
  };

  const normalizeField = (f: any): Field => {
    if (!f) {
      return {
        id: 'field_' + Math.random().toString(36).slice(2, 11),
        type: 'text',
        label: '',
        options: [],
        styleType: 'bordered',
        inline: false,
        hideLabel: false
      };
    }
    return {
      id: f.id || 'field_' + Math.random().toString(36).slice(2, 11),
      type: f.type || 'text',
      label: f.label || '',
      options: normalizeOptions(f.options),
      styleType: f.styleType || 'bordered',
      inline: !!f.inline,
      hideLabel: !!f.hideLabel
    };
  };

  // Initialize metadata from mistake or initial context
  useEffect(() => {
    if (mistake) {
      setTitle(mistake.title || '');
      setMistakeDate(mistake.mistake_date || new Date(mistake.created_at).toISOString().slice(0, 10));
      setSubjectId(mistake.subject_id || '');
      setSelectedChapterId(mistake.chapter_id || '');
      setUnitId(mistake.unit_id || '');
      const effFamId = mistake.familiarity_id || getEffectiveFamiliarityId(mistake, categories.familiarities) || '';
      setFamiliarityId(effFamId);
      setErrorReasonIds(Array.isArray(mistake.error_reason_ids) ? mistake.error_reason_ids : []);
      setTags(Array.isArray(mistake.tags) ? mistake.tags : []);
    } else {
      let resolvedSubj = initialSubjectId || '';
      const resolvedChap = chapterId || '';
      const resolvedUnit = initialUnitId || '';

      if (resolvedChap && !resolvedSubj) {
        const ch = categories.chapters.find(c => c.id === resolvedChap);
        if (ch?.parent_id) resolvedSubj = ch.parent_id;
      }
      setSubjectId(resolvedSubj);
      setSelectedChapterId(resolvedChap);
      setUnitId(resolvedUnit);
      setFamiliarityId('');
      setErrorReasonIds([]);
      setTags([]);
      setMistakeDate(new Date().toISOString().slice(0, 10));
    }
  }, [mistake, initialSubjectId, chapterId, initialUnitId, categories.chapters, categories.familiarities]);

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await apiRequest('/api/templates');
        const normalized = (res || []).filter(Boolean).map((t: any) => ({
          ...t,
          fields: {
            questionFields: (t.fields?.questionFields || [])
              .filter((f: any) => !isLegacyMasteryField(f))
              .map(normalizeField),
            answerFields: (t.fields?.answerFields || [])
              .filter((f: any) => !isLegacyMasteryField(f))
              .map(normalizeField)
          }
        }));
        setTemplates(normalized);

        if (mistake) {
          setSelectedTemplateId(mistake.template_id || '');
          const tpl = normalized.find((t: Template) => t && t.id === mistake.template_id) || normalized[0];
          if (tpl) {
            setSelectedTemplate(tpl);
            setQuestionData(mistake.data?.questionData || {});
            const cleanAnsData = { ...(mistake.data?.answerData || {}) };
            delete cleanAnsData.a_mastery;
            for (const [k, v] of Object.entries(cleanAnsData)) {
              if (typeof v === 'string' && ['順', '卡', '不會', '誤解', '會'].includes(v.trim())) {
                delete cleanAnsData[k];
              } else if (Array.isArray(v) && v.length > 0 && v.every(it => typeof it === 'string' && ['順', '卡', '不會', '誤解', '會'].includes(it.trim()))) {
                delete cleanAnsData[k];
              }
            }
            setAnswerData(cleanAnsData);
          }
        } else if (normalized.length > 0) {
          setSelectedTemplateId(normalized[0].id || '');
          setSelectedTemplate(normalized[0]);
          setQuestionData({});
          setAnswerData({});
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTemplates();
  }, [mistake]);

  // Cascading chapters & units for dropdowns
  const availableChapters = useMemo(() => {
    if (!subjectId) return categories.chapters.filter(c => c.is_active === 1 || c.id === selectedChapterId);
    return categories.chapters.filter(
      c => c.parent_id === subjectId && (c.is_active === 1 || c.id === selectedChapterId)
    );
  }, [categories.chapters, subjectId, selectedChapterId]);

  const availableUnits = useMemo(() => {
    if (!selectedChapterId) return [];
    return categories.units.filter(
      u => u.parent_id === selectedChapterId && (u.is_active === 1 || u.id === unitId)
    );
  }, [categories.units, selectedChapterId, unitId]);

  // Keep error reason filter subject/chapter defaults synced with current Subject / Chapter selection
  useEffect(() => {
    if (subjectId) setErrorFilterSubjectId(subjectId);
    if (selectedChapterId) setErrorFilterChapterId(selectedChapterId);
  }, [subjectId, selectedChapterId]);

  const availableErrorReasons = useMemo(() => {
    const activeList = categories.errorReasons.filter(
      r => r.is_active === 1 || errorReasonIds.includes(r.id)
    );

    if (errorFilterScope === 'global') {
      return activeList.filter(r => !r.parent_id);
    }
    if (errorFilterScope === 'subject') {
      const targetSubj = errorFilterSubjectId || subjectId;
      if (!targetSubj) return activeList.filter(r => r.parent_id && categories.subjects.some(s => s.id === r.parent_id));
      return activeList.filter(r => r.parent_id === targetSubj);
    }
    if (errorFilterScope === 'chapter') {
      const targetChap = errorFilterChapterId || selectedChapterId;
      if (!targetChap) return activeList.filter(r => r.parent_id && categories.chapters.some(c => c.id === r.parent_id));
      return activeList.filter(r => r.parent_id === targetChap);
    }

    // 'auto' mode: show global + current subject + current chapter (or all if no subject/chapter picked yet)
    return activeList.filter(r => {
      if (errorReasonIds.includes(r.id)) return true;
      if (!r.parent_id) return true; // Global error reason
      if (selectedChapterId) {
        return r.parent_id === selectedChapterId || r.parent_id === subjectId;
      }
      if (subjectId) {
        return r.parent_id === subjectId || r.subject_id === subjectId;
      }
      return true;
    });
  }, [
    categories.errorReasons,
    categories.subjects,
    categories.chapters,
    errorFilterScope,
    errorFilterSubjectId,
    errorFilterChapterId,
    subjectId,
    selectedChapterId,
    errorReasonIds
  ]);

  const handleSubjectChange = (nextSubjId: string) => {
    setSubjectId(nextSubjId);
    setSelectedChapterId('');
    setUnitId('');
  };

  const handleChapterChange = (nextChapId: string) => {
    setSelectedChapterId(nextChapId);
    setUnitId('');
    if (nextChapId) {
      const ch = categories.chapters.find(c => c.id === nextChapId);
      if (ch?.parent_id) setSubjectId(ch.parent_id);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tpl = templates.find(t => t.id === templateId) || null;
    setSelectedTemplate(tpl);
    setQuestionData({});
    setAnswerData({});
  };

  const handleToggleErrorReason = (reasonId: string) => {
    if (categories.errorReasonMode === 'single') {
      setErrorReasonIds(prev => (prev.includes(reasonId) ? [] : [reasonId]));
    } else {
      setErrorReasonIds(prev =>
        prev.includes(reasonId) ? prev.filter(id => id !== reasonId) : [...prev, reasonId]
      );
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setTags(prev => prev.filter(x => x !== t));
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldId: string,
    section: 'question' | 'answer'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFields(prev => ({ ...prev, [fieldId]: true }));

    try {
      const compressedBlob = await compressImage(file, 1200, 0.8);
      const res = await apiRequest('/api/images/upload', {
        method: 'POST',
        body: compressedBlob,
        headers: {
          'Content-Type': 'image/jpeg'
        }
      });

      if (section === 'question') {
        setQuestionData(prev => ({ ...prev, [fieldId]: res.key }));
      } else {
        setAnswerData(prev => ({ ...prev, [fieldId]: res.key }));
      }
    } catch (e) {
      alert('圖片上傳失敗：' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploadingFields(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const handleOptionToggle = (
    fieldId: string,
    option: string,
    section: 'question' | 'answer'
  ) => {
    const currentData = section === 'question' ? questionData : answerData;
    const selectedOptions = Array.isArray(currentData[fieldId]) ? currentData[fieldId] : [];

    const nextOptions = selectedOptions.includes(option)
      ? selectedOptions.filter((o: string) => o !== option)
      : [...selectedOptions, option];

    if (section === 'question') {
      setQuestionData(prev => ({ ...prev, [fieldId]: nextOptions }));
    } else {
      setAnswerData(prev => ({ ...prev, [fieldId]: nextOptions }));
    }

    // Two-way synchronization: If this field is a mastery/familiarity field or option is a standard familiarity name
    const optTrimmed = option.trim();
    const matchingFam = categories.familiarities.find(
      f => f.name === optTrimmed || (optTrimmed === '會' && f.name === '順')
    );
    if (matchingFam) {
      if (nextOptions.includes(option)) {
        setFamiliarityId(matchingFam.id);
      } else if (familiarityId === matchingFam.id) {
        setFamiliarityId('');
      }
    }
  };

  const handleFamiliaritySelect = (fId: string) => {
    const nextFId = familiarityId === fId ? '' : fId;
    setFamiliarityId(nextFId);

    // Keep answerData clean from legacy mastery field
    setAnswerData(prev => {
      const next = { ...prev };
      delete next.a_mastery;
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('請輸入錯題名稱！');
      return;
    }

    setLoading(true);
    const payload = {
      title: title.trim(),
      subjectId: subjectId || null,
      chapterId: selectedChapterId || null,
      unitId: unitId || null,
      familiarityId: familiarityId || null,
      errorReasonIds,
      tags,
      mistakeDate,
      templateId: selectedTemplateId,
      data: {
        questionData,
        answerData
      }
    };

    try {
      if (mistake) {
        await apiRequest('/api/mistakes', {
          method: 'PUT',
          body: { id: mistake.id, ...payload }
        });
      } else {
        await apiRequest('/api/mistakes', {
          method: 'POST',
          body: payload
        });
      }
      onSaveSuccess();
    } catch (e) {
      alert(e instanceof Error ? e.message : '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} className="animate-fade-in no-print">
      <div className="glass notebook-page washi-tape-strip" style={{
        width: '100%',
        maxWidth: '920px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Editor Header */}
        <div style={{
          padding: '18px 28px',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {mistake ? '編輯錯題紀錄' : '剪貼新增錯題紀錄'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
              剪貼題卡、填寫解析，支援設定五大分類維度（亦可留空作為未分類錯題）與自訂標籤
            </p>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Editor Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Beginner-friendly hint banner */}
          <div style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(25, 122, 39, 0.08)',
            border: '1px dashed var(--accent-secondary)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5
          }}>
            <strong style={{ color: 'var(--accent-primary)' }}>新手小提示：</strong>
            只需填寫「<strong style={{ color: 'var(--accent-secondary)' }}>錯題標題</strong>」即可先儲存！下方的科目、章節、熟悉度、錯因標籤與題目圖片皆可依需求自由選填，隨時都能再回來修改。
          </div>

          {/* Row 1: Title, Date, Template */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">錯題標題 / 簡述 *</label>
              <input
                type="text"
                className="input"
                style={{ padding: '9px 12px', fontSize: '0.92rem' }}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="請輸入錯題標題（例如：115學測單選第三題）..."
                data-testid="mistake-title-input"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">測驗 / 紀錄日期</label>
              <input
                type="date"
                className="input"
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                value={mistakeDate}
                onChange={e => setMistakeDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">選擇欄位模板</label>
              <select
                className="input"
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                value={selectedTemplateId}
                onChange={e => handleTemplateChange(e.target.value)}
                disabled={!!mistake}
              >
                <option value="" disabled>-- 請選擇欄位模板 --</option>
                {templates.filter(t => t && t.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Cascading Hierarchy (Subject -> Chapter -> Unit) */}
          <div style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div className="grid grid-cols-3" style={{ gap: '14px' }}>
              <div>
                <label className="form-label">1. 科目（可選未分類）</label>
                <select
                  className="input"
                  style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                  value={subjectId}
                  onChange={e => handleSubjectChange(e.target.value)}
                  data-testid="editor-subject-select"
                >
                  <option value="">-- 未分類科目 --</option>
                  {categories.subjects
                    .filter(s => s.is_active === 1 || s.id === subjectId)
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="form-label">2. 章節（依科目連動）</label>
                <select
                  className="input"
                  style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                  value={selectedChapterId}
                  onChange={e => handleChapterChange(e.target.value)}
                  data-testid="editor-chapter-select"
                >
                  <option value="">-- 未分類章節 --</option>
                  {availableChapters.map(c => {
                    const subj = categories.subjects.find(s => s.id === c.parent_id);
                    return (
                      <option key={c.id} value={c.id}>
                        {!subjectId && subj ? `${subj.name} / ` : ''}{c.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="form-label">3. 單元（依章節連動）</label>
                <select
                  className="input"
                  style={{ padding: '8px 12px', fontSize: '0.88rem' }}
                  value={unitId}
                  onChange={e => setUnitId(e.target.value)}
                  disabled={!selectedChapterId}
                  data-testid="editor-unit-select"
                >
                  <option value="">{selectedChapterId ? '-- 未指定單元 --' : '-- 請先選擇章節 --'}</option>
                  {availableUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Familiarity (Single-select) & Error Reasons (Multi-select) */}
            <div className="grid grid-cols-2" style={{ gap: '16px' }}>
              <div>
                <label className="form-label">4. 熟悉度（單選，再次點擊可取消）</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.familiarities
                    .filter(f => f.is_active === 1 || f.id === familiarityId)
                    .map(f => {
                      const active = familiarityId === f.id;
                      const color = f.color === 'success' ? '#197A27' : f.color === 'warning' ? '#D97706' : f.color === 'danger' ? '#C5221F' : '#001F65';
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleFamiliaritySelect(active ? '' : f.id)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '14px',
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            border: `1px solid ${active ? color : 'var(--glass-border)'}`,
                            background: active ? `${color}28` : 'var(--glass-bg)',
                            color: active ? color : 'var(--text-secondary)',
                            fontWeight: active ? 700 : 400
                          }}
                          data-testid={`editor-familiarity-${f.name}`}
                        >
                          {f.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="form-label">
                  5. 錯因（{categories.errorReasonMode === 'single' ? '單選模式' : '可多選'}｜可用選單切換通用 / 特定科目 / 章節錯因）
                </label>

                {/* Dropdown Menus to filter scope (Global / Specific Subject / Specific Chapter) and pick Error Reason */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                  <select
                    className="input"
                    style={{ width: 'auto', flex: '1 1 180px', padding: '5px 8px', fontSize: '0.8rem', height: '34px' }}
                    value={errorFilterScope}
                    onChange={e => setErrorFilterScope(e.target.value as 'auto' | 'global' | 'subject' | 'chapter')}
                    data-testid="editor-error-scope-select"
                  >
                    <option value="auto">自動顯示（通用 + 本題所選科目/章節）</option>
                    <option value="global">僅顯示：全科目通用錯因</option>
                    <option value="subject">依特定科目選擇錯因</option>
                    <option value="chapter">依特定章節選擇錯因</option>
                  </select>

                  {errorFilterScope === 'subject' && (
                    <select
                      className="input"
                      style={{ width: 'auto', flex: '1 1 140px', padding: '5px 8px', fontSize: '0.8rem', height: '34px' }}
                      value={errorFilterSubjectId}
                      onChange={e => setErrorFilterSubjectId(e.target.value)}
                      data-testid="editor-error-subject-select"
                    >
                      <option value="">-- 全部科目專屬錯因 --</option>
                      {categories.subjects.filter(s => s.is_active === 1).map(s => (
                        <option key={s.id} value={s.id}>科目：{s.name}</option>
                      ))}
                    </select>
                  )}

                  {errorFilterScope === 'chapter' && (
                    <select
                      className="input"
                      style={{ width: 'auto', flex: '1 1 160px', padding: '5px 8px', fontSize: '0.8rem', height: '34px' }}
                      value={errorFilterChapterId}
                      onChange={e => setErrorFilterChapterId(e.target.value)}
                      data-testid="editor-error-chapter-select"
                    >
                      <option value="">-- 全部章節專屬錯因 --</option>
                      {categories.chapters
                        .filter(c => c.is_active === 1 && (!subjectId || c.parent_id === subjectId))
                        .map(c => {
                          const subj = categories.subjects.find(s => s.id === c.parent_id);
                          return (
                            <option key={c.id} value={c.id}>
                              {subj ? `${subj.name} / ` : ''}{c.name}
                            </option>
                          );
                        })}
                    </select>
                  )}

                  {/* Direct Dropdown Selector to Pick an Error Reason Tag */}
                  <select
                    className="input"
                    style={{ width: '100%', padding: '5px 8px', fontSize: '0.8rem', height: '34px' }}
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (val) handleToggleErrorReason(val);
                    }}
                    data-testid="editor-error-reason-select"
                  >
                    <option value="">-- 點此從選單挑選錯因標籤（或直接點擊下方按鈕） --</option>
                    {availableErrorReasons.map(r => {
                      const isChap = r.parent_id && categories.chapters.some(c => c.id === r.parent_id);
                      const isSubj = r.parent_id && !isChap && categories.subjects.some(s => s.id === r.parent_id);
                      const scopeLabel = isChap
                        ? `[章節：${categories.chapters.find(c => c.id === r.parent_id)?.name || ''}]`
                        : isSubj
                        ? `[科目：${categories.subjects.find(s => s.id === r.parent_id)?.name || ''}]`
                        : '[通用]';
                      const alreadySelected = errorReasonIds.includes(r.id);
                      return (
                        <option key={r.id} value={r.id}>
                          {alreadySelected ? '[已選] ' : ''}{scopeLabel} {r.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Clickable Error Reason Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {availableErrorReasons.map(r => {
                    const active = errorReasonIds.includes(r.id);
                    const isChapScoped = r.parent_id && categories.chapters.some(c => c.id === r.parent_id);
                    const isSubjScoped = r.parent_id && !isChapScoped && categories.subjects.some(s => s.id === r.parent_id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleToggleErrorReason(r.id)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '14px',
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          border: `1.5px solid ${active ? 'var(--warning)' : 'var(--glass-border)'}`,
                          background: active ? 'var(--warning-glow)' : 'var(--glass-bg)',
                          color: active ? 'var(--warning)' : 'var(--text-primary)',
                          fontWeight: active ? 700 : 500,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        data-testid={`editor-error-reason-${r.name}`}
                      >
                        <span>{r.name}</span>
                        {isChapScoped && (
                          <span className="scope-badge-chapter">
                            章節
                          </span>
                        )}
                        {isSubjScoped && (
                          <span className="scope-badge-subject">
                            科目
                          </span>
                        )}
                        {!isChapScoped && !isSubjScoped && (
                          <span className="scope-badge-global">通用</span>
                        )}
                      </button>
                    );
                  })}
                  {availableErrorReasons.length === 0 && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      此範圍尚無錯因標籤，請切換上方範圍選單，或於主畫面左側「2. 錯因標籤設定」面板新增。
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  提示：若想新增或刪除「通用 / 科目 / 章節」錯因標籤，可隨時在頁面左側邊欄的「2. 錯因標籤設定」獨立面板設定。
                </div>
              </div>
            </div>

            {/* Row 4: Custom Tags */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Tag size={14} /> 自訂標籤：
              </span>
              {tags.map(t => (
                <span
                  key={t}
                  style={{
                    fontSize: '0.78rem',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontWeight: 700 }}
                  >
                    &times;
                  </button>
                </span>
              ))}
              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input"
                  style={{ width: '160px', padding: '4px 10px', fontSize: '0.8rem' }}
                  placeholder="輸入自訂標籤..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={handleAddTag}
                >
                  <Plus size={12} /> 新增標籤
                </button>
              </div>
            </div>
          </div>

          {/* Template Fields Columns */}
          {selectedTemplate ? (
            <div className="grid grid-cols-2" style={{ gap: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '18px' }}>
              {/* Question Fields Column */}
              <div className="scrapbook-card" style={{ padding: '18px', background: 'var(--bg-secondary)', border: '1.5px dashed var(--glass-border)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)', borderBottom: '1.5px dashed var(--glass-border)', paddingBottom: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>1. 題目卡片剪貼</span>
                </h4>

                {selectedTemplate.fields.questionFields?.map(field => (
                  <div
                    key={field.id}
                    style={{
                      display: field.inline ? 'inline-flex' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      verticalAlign: 'bottom',
                      marginRight: field.inline ? '16px' : '0',
                      marginBottom: '20px',
                      width: field.inline ? (field.type === 'options' ? 'auto' : '180px') : '100%'
                    }}
                  >
                    {!field.hideLabel && <label className="form-label" style={{ marginBottom: '6px' }}>{field.label}</label>}
                    {field.hideLabel && field.inline && <div style={{ height: '23px' }} />}
                    <DynamicFieldInput
                      field={field}
                      value={questionData[field.id]}
                      onChange={val => setQuestionData(prev => ({ ...prev, [field.id]: val }))}
                      onImageUpload={e => handleImageUpload(e, field.id, 'question')}
                      uploading={uploadingFields[field.id]}
                      onOptionToggle={opt => handleOptionToggle(field.id, opt, 'question')}
                      onImageClick={onImageClick}
                    />
                  </div>
                ))}
              </div>

              {/* Answer Fields Column */}
              <div className="scrapbook-card" style={{ padding: '18px', background: 'var(--bg-secondary)', border: '1.5px dashed var(--accent-secondary)' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-secondary)', borderBottom: '1.5px dashed var(--glass-border)', paddingBottom: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>2. 答案與解析便利貼</span>
                </h4>

                {selectedTemplate.fields.answerFields?.map(field => (
                  <div
                    key={field.id}
                    style={{
                      display: field.inline ? 'inline-flex' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      verticalAlign: 'bottom',
                      marginRight: field.inline ? '16px' : '0',
                      marginBottom: '20px',
                      width: field.inline ? (field.type === 'options' ? 'auto' : '180px') : '100%'
                    }}
                  >
                    {!field.hideLabel && <label className="form-label" style={{ marginBottom: '6px' }}>{field.label}</label>}
                    {field.hideLabel && field.inline && <div style={{ height: '23px' }} />}
                    <DynamicFieldInput
                      field={field}
                      value={answerData[field.id]}
                      onChange={val => setAnswerData(prev => ({ ...prev, [field.id]: val }))}
                      onImageUpload={e => handleImageUpload(e, field.id, 'answer')}
                      uploading={uploadingFields[field.id]}
                      onOptionToggle={opt => handleOptionToggle(field.id, opt, 'answer')}
                      onImageClick={onImageClick}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Editor Footer */}
        <div style={{
          padding: '14px 28px',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
            data-testid="save-mistake-btn"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            儲存錯題
          </button>
        </div>
      </div>
    </div>
  );
}

interface DynamicFieldInputProps {
  field: Field;
  value: any;
  onChange: (val: any) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
  onOptionToggle: (option: string) => void;
  onImageClick?: (src: string) => void;
}

function DynamicFieldInput({
  field,
  value,
  onChange,
  onImageUpload,
  uploading = false,
  onOptionToggle,
  onImageClick
}: DynamicFieldInputProps) {
  const getOptionStyles = (isChecked: boolean, color?: string) => {
    let borderColor = 'var(--glass-border)';
    let activeBg = 'rgba(99, 102, 241, 0.1)';
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
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      background: isChecked ? activeBg : 'var(--glass-bg)',
      border: `1px solid ${isChecked ? activeBorder : borderColor}`,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      color: textColor,
      transition: 'all 0.2s'
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
        width: '16px',
        height: '16px',
        border: boxBorder,
        borderRadius: '3px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.05)',
        position: 'relative'
      }}>
        {isChecked && (
          <span style={{
            color: checkColor,
            fontWeight: 'bold',
            fontSize: '1.25rem',
            position: 'absolute',
            top: '-5px',
            left: '1px',
            fontFamily: '"Architects Daughter", cursive, sans-serif'
          }}>
            ✓
          </span>
        )}
      </div>
    );
  };

  switch (field.type) {
    case 'text': {
      const underlineStyle = field.styleType === 'underline' ? {
        border: 'none',
        borderBottom: '1px solid var(--text-primary)',
        borderRadius: 0,
        background: 'transparent',
        paddingLeft: '4px',
        paddingRight: '4px',
        width: field.inline ? '120px' : '100%'
      } : {};

      return (
        <input
          type="text"
          className="input"
          style={underlineStyle}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.styleType === 'underline' ? '' : `請輸入${field.label}`}
        />
      );
    }
    case 'textarea': {
      const textareaUnderlineStyle = field.styleType === 'underline' ? {
        border: 'none',
        borderBottom: '1px solid var(--text-primary)',
        borderRadius: 0,
        background: 'transparent',
        paddingLeft: '4px',
        paddingRight: '4px',
        width: '100%',
        resize: 'vertical' as const
      } : {};

      return (
        <textarea
          className="input"
          rows={field.styleType === 'underline' ? 2 : 4}
          style={textareaUnderlineStyle}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.styleType === 'underline' ? '' : `請輸入${field.label}`}
        />
      );
    }
    case 'image': {
      const imageKey = value as string;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          {imageKey ? (
            <div style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--glass-border)',
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.2)',
              width: '100%',
              maxWidth: '300px',
              aspectRatio: '16/9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={`/api/images/${imageKey}`}
                alt={field.label}
                onClick={() => onImageClick?.(`/api/images/${imageKey}`)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: onImageClick ? 'zoom-in' : 'default' }}
              />
              <button
                type="button"
                onClick={() => onChange('')}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(239, 68, 68, 0.8)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.8rem'
                }}
              >
                &times;
              </button>
            </div>
          ) : (
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px dashed var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              cursor: uploading ? 'default' : 'pointer',
              background: 'var(--glass-bg)',
              transition: 'all 0.2s',
              textAlign: 'center',
              width: '100%'
            }} className="btn-secondary-hover-bg">
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>壓縮並上傳中...</span>
                </>
              ) : (
                <>
                  <ImageIcon size={24} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>點擊上傳圖片 (自動壓縮)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </label>
          )}
        </div>
      );
    }
    case 'options': {
      const checkedOptions = Array.isArray(value) ? value : [];
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {field.options?.map((opt, i) => {
            const isChecked = checkedOptions.includes(opt.value);
            return (
              <div
                key={i}
                onClick={() => onOptionToggle(opt.value)}
                style={getOptionStyles(isChecked, opt.color)}
              >
                {renderCheckbox(isChecked, opt.color)}
                <span style={{ fontSize: '0.9rem' }}>{opt.value}</span>
              </div>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>無選項可選</span>
          )}
        </div>
      );
    }
  }
}
