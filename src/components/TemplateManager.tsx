import React, { Component, useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, List } from 'lucide-react';

interface FieldOption {
  value: string;
  color?: 'default' | 'danger' | 'warning' | 'success';
}

interface Field {
  id: string;
  type: 'text' | 'textarea' | 'image' | 'options';
  label: string;
  options?: FieldOption[];
  styleType?: 'bordered' | 'underline';
  inline?: boolean;
  hideLabel?: boolean;
}

interface Template {
  id: string;
  name: string;
  fields: {
    questionFields: Field[];
    answerFields: Field[];
  };
  created_at: number;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught error in TemplateManager", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', flex: 1, margin: '24px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>自訂模板管理發生渲染錯誤！</h3>
          <p style={{ fontSize: '0.88rem', marginTop: '4px', color: 'var(--text-secondary)' }}>這可能是由於載入舊版本資料庫時產生的不相容所致：</p>
          <pre style={{ fontSize: '0.82rem', marginTop: '10px', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', border: '1px solid var(--glass-border)', color: '#fff' }}>
            {this.state.error?.toString()}
            {"\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  
  // Template Form State
  const [templateName, setTemplateName] = useState('');
  const [questionFields, setQuestionFields] = useState<Field[]>([]);
  const [answerFields, setAnswerFields] = useState<Field[]>([]);

  // Temp choice option state
  const [optionInputs, setOptionInputs] = useState<{ [fieldId: string]: string }>({});

  const normalizeOptions = (options: any): FieldOption[] => {
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
        id: 'field_' + Math.random().toString(36).substr(2, 9),
        type: 'text',
        label: '',
        options: [],
        styleType: 'bordered',
        inline: false,
        hideLabel: false
      };
    }
    return {
      id: f.id || 'field_' + Math.random().toString(36).substr(2, 9),
      type: f.type || 'text',
      label: f.label || '',
      options: normalizeOptions(f.options),
      styleType: f.styleType || 'bordered',
      inline: !!f.inline,
      hideLabel: !!f.hideLabel
    };
  };

  const fetchTemplates = async () => {
    try {
      const res = await apiRequest('/api/templates');
      setTemplates(res);
      if (res.length > 0 && !selectedTemplateId) {
        // Find the template that matches selectedTemplateId, or load the first one
        loadTemplate(res[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const loadTemplate = (tpl: Template) => {
    if (!tpl) return;
    setSelectedTemplateId(tpl.id || null);
    setTemplateName(tpl.name || '');
    setQuestionFields((tpl.fields?.questionFields || []).map(normalizeField));
    setAnswerFields((tpl.fields?.answerFields || []).map(normalizeField));
  };

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setTemplateName('新模板');
    setQuestionFields([
      { id: 'q_' + Math.random().toString(36).substr(2, 9), type: 'text', label: '題目說明' }
    ]);
    setAnswerFields([
      { id: 'a_' + Math.random().toString(36).substr(2, 9), type: 'textarea', label: '答案與解析' }
    ]);
  };

  const addField = (section: 'question' | 'answer', type: Field['type']) => {
    const newField: Field = {
      id: (section === 'question' ? 'q_' : 'a_') + Math.random().toString(36).substr(2, 9),
      type,
      label: type === 'image' ? '上傳圖片' : type === 'options' ? '選擇題選項' : '文字說明',
      options: type === 'options' ? [
        { value: 'A', color: 'default' },
        { value: 'B', color: 'default' },
        { value: 'C', color: 'default' },
        { value: 'D', color: 'default' }
      ] : undefined,
      styleType: 'bordered',
      inline: false,
      hideLabel: false
    };

    if (section === 'question') {
      setQuestionFields(prev => [...prev, newField]);
    } else {
      setAnswerFields(prev => [...prev, newField]);
    }
  };

  const updateFieldProp = (section: 'question' | 'answer', index: number, key: keyof Field, value: any) => {
    if (section === 'question') {
      setQuestionFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f));
    } else {
      setAnswerFields(prev => prev.map((f, i) => i === index ? { ...f, [key]: value } : f));
    }
  };

  const updateOptionColor = (section: 'question' | 'answer', fieldIndex: number, optionIndex: number, color: FieldOption['color']) => {
    const list = section === 'question' ? [...questionFields] : [...answerFields];
    const field = list[fieldIndex];
    if (field.options) {
      field.options = field.options.map((opt, i) => i === optionIndex ? { ...opt, color } : opt);
    }
    if (section === 'question') setQuestionFields(list);
    else setAnswerFields(list);
  };

  const deleteField = (section: 'question' | 'answer', index: number) => {
    if (section === 'question') {
      setQuestionFields(prev => prev.filter((_, i) => i !== index));
    } else {
      setAnswerFields(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateFieldLabel = (section: 'question' | 'answer', index: number, label: string) => {
    if (section === 'question') {
      setQuestionFields(prev => prev.map((f, i) => i === index ? { ...f, label } : f));
    } else {
      setAnswerFields(prev => prev.map((f, i) => i === index ? { ...f, label } : f));
    }
  };

  const moveField = (section: 'question' | 'answer', index: number, direction: 'up' | 'down') => {
    const list = section === 'question' ? [...questionFields] : [...answerFields];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === list.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = temp;

    if (section === 'question') {
      setQuestionFields(list);
    } else {
      setAnswerFields(list);
    }
  };

  // Option lists helpers (for multiple choice)
  const addOption = (section: 'question' | 'answer', fieldIndex: number, fieldId: string) => {
    const optionText = optionInputs[fieldId] || '';
    if (!optionText.trim()) return;

    const list = section === 'question' ? [...questionFields] : [...answerFields];
    const field = list[fieldIndex];
    field.options = [...(field.options || []), { value: optionText.trim(), color: 'default' }];

    if (section === 'question') setQuestionFields(list);
    else setAnswerFields(list);

    setOptionInputs(prev => ({ ...prev, [fieldId]: '' }));
  };

  const deleteOption = (section: 'question' | 'answer', fieldIndex: number, optionIndex: number) => {
    const list = section === 'question' ? [...questionFields] : [...answerFields];
    const field = list[fieldIndex];
    if (field.options) {
      field.options = field.options.filter((_, i) => i !== optionIndex);
    }

    if (section === 'question') setQuestionFields(list);
    else setAnswerFields(list);
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('請輸入模板名稱！');
      return;
    }
    if (questionFields.length === 0) {
      alert('題目區必須至少有一個欄位！');
      return;
    }

    const payload = {
      name: templateName.trim(),
      fields: {
        questionFields,
        answerFields
      }
    };

    try {
      if (selectedTemplateId) {
        // Edit template
        await apiRequest('/api/templates', {
          method: 'PUT',
          body: { id: selectedTemplateId, ...payload }
        });
        alert('模板更新成功！');
      } else {
        // Create template
        const res = await apiRequest('/api/templates', {
          method: 'POST',
          body: payload
        });
        setSelectedTemplateId(res.template.id);
        alert('模板儲存成功！');
      }
      fetchTemplates();
    } catch (e) {
      alert(e instanceof Error ? e.message : '儲存失敗');
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`確定要刪除「${name}」模板嗎？`)) return;
    try {
      await apiRequest(`/api/templates?id=${id}`, {
        method: 'DELETE'
      });
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(null);
        setTemplateName('');
        setQuestionFields([]);
        setAnswerFields([]);
      }
      alert('模板已刪除！');
    } catch (e) {
      alert(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  return (
    <div style={{ display: 'flex', gap: '24px', flex: 1, padding: '24px' }} className="animate-fade-in">
      {/* Templates List Sidebar */}
      <div className="glass" style={{ width: '250px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <List size={16} /> 模板列表
          </h3>
          <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={handleCreateNew}>
            <Plus size={14} /> 新增
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
          {templates.filter(t => t && t.id).map(t => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: selectedTemplateId === t.id ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.02)',
                color: selectedTemplateId === t.id ? '#fff' : 'var(--text-primary)',
                transition: 'all 0.2s'
              }}
              onClick={() => loadTemplate(t)}
            >
              <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                {t.name}
              </span>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: selectedTemplateId === t.id ? '#ffffff' : 'var(--text-muted)',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTemplate(t.id, t.name);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {templates.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', fontSize: '0.85rem' }}>
              暫無模板
            </div>
          )}
        </div>
      </div>

      {/* Template Editor */}
      <div className="glass" style={{ flex: 1, padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>自訂模板編輯器</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>分別為題目與答案設計所需的欄位</p>
          </div>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> 儲存模板
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">模板名稱</label>
          <input
            type="text"
            className="input"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="例如：英文單字題、數學非選擇題..."
          />
        </div>

        <div className="grid grid-cols-2" style={{ gap: '24px', flex: 1, minHeight: '350px' }}>
          {/* Question Fields Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid var(--glass-border)', paddingRight: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>1. 題目區欄位</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('question', 'text')}>+單行</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('question', 'textarea')}>+多行</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('question', 'image')}>+圖片</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('question', 'options')}>+選項</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
              {questionFields.map((field, index) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  index={index}
                  section="question"
                  onUpdateLabel={(val) => updateFieldLabel('question', index, val)}
                  onDelete={() => deleteField('question', index)}
                  onMoveUp={() => moveField('question', index, 'up')}
                  onMoveDown={() => moveField('question', index, 'down')}
                  // Option list logic
                  optionInput={optionInputs[field.id] || ''}
                  onOptionInputChange={(val) => setOptionInputs(prev => ({ ...prev, [field.id]: val }))}
                  onAddOption={() => addOption('question', index, field.id)}
                  onDeleteOption={(optIndex) => deleteOption('question', index, optIndex)}
                  onUpdateProp={(key, val) => updateFieldProp('question', index, key, val)}
                  onUpdateOptionColor={(optIndex, color) => updateOptionColor('question', index, optIndex, color)}
                />
              ))}
              {questionFields.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                  尚未新增任何題目欄位，請點擊右上方新增按鈕。
                </div>
              )}
            </div>
          </div>

          {/* Answer Fields Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--success)' }}>2. 答案與解析區欄位</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('answer', 'text')}>+單行</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('answer', 'textarea')}>+多行</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('answer', 'image')}>+圖片</button>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => addField('answer', 'options')}>+選項</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
              {answerFields.map((field, index) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  index={index}
                  section="answer"
                  onUpdateLabel={(val) => updateFieldLabel('answer', index, val)}
                  onDelete={() => deleteField('answer', index)}
                  onMoveUp={() => moveField('answer', index, 'up')}
                  onMoveDown={() => moveField('answer', index, 'down')}
                  // Option list logic
                  optionInput={optionInputs[field.id] || ''}
                  onOptionInputChange={(val) => setOptionInputs(prev => ({ ...prev, [field.id]: val }))}
                  onAddOption={() => addOption('answer', index, field.id)}
                  onDeleteOption={(optIndex) => deleteOption('answer', index, optIndex)}
                  onUpdateProp={(key, val) => updateFieldProp('answer', index, key, val)}
                  onUpdateOptionColor={(optIndex, color) => updateOptionColor('answer', index, optIndex, color)}
                />
              ))}
              {answerFields.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', border: '1px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                  尚未新增任何答案與解析欄位。
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper card rendering for custom fields inside TemplateManager
interface FieldCardProps {
  field: Field;
  index: number;
  section: 'question' | 'answer';
  onUpdateLabel: (label: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  optionInput: string;
  onOptionInputChange: (val: string) => void;
  onAddOption: () => void;
  onDeleteOption: (index: number) => void;
  onUpdateProp: (key: keyof Field, val: any) => void;
  onUpdateOptionColor: (optIndex: number, color: FieldOption['color']) => void;
}

function FieldCard({
  field,
  onUpdateLabel,
  onDelete,
  onMoveUp,
  onMoveDown,
  optionInput,
  onOptionInputChange,
  onAddOption,
  onDeleteOption,
  onUpdateProp,
  onUpdateOptionColor
}: FieldCardProps) {
  const getTypeLabel = (type: Field['type']) => {
    switch (type) {
      case 'text': return '單行文字';
      case 'textarea': return '多行段落';
      case 'image': return '圖片上傳';
      case 'options': return '勾選清單';
    }
  };

  const getOptionColorStyle = (color?: string) => {
    switch (color) {
      case 'danger': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'success': return '#10b981';
      default: return 'var(--accent-gradient)';
    }
  };

  return (
    <div
      style={{
        padding: '14px',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(255, 255, 255, 0.01)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '10px',
            color: 'var(--text-secondary)'
          }}
        >
          {getTypeLabel(field.type)}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={onMoveUp}>
            <ArrowUp size={14} />
          </button>
          <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={onMoveDown}>
            <ArrowDown size={14} />
          </button>
          <button style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', marginLeft: '6px' }} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <input
          type="text"
          className="input"
          style={{ padding: '8px 12px', fontSize: '0.9rem' }}
          placeholder="欄位標題 (例如：題目照片、計分、選擇答案)"
          value={field.label}
          onChange={(e) => onUpdateLabel(e.target.value)}
        />
      </div>

      {/* Advanced Layout and Style Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', marginTop: '4px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
        {/* Style selection (Only for text or textarea) */}
        {(field.type === 'text' || field.type === 'textarea') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>樣式:</span>
            <select
              value={field.styleType || 'bordered'}
              onChange={(e) => onUpdateProp('styleType', e.target.value)}
              style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.8rem' }}
            >
              <option value="bordered">圓角外框</option>
              <option value="underline">填空底線</option>
            </select>
          </div>
        )}

        {/* Layout selection */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>排版:</span>
          <select
            value={field.inline ? 'inline' : 'block'}
            onChange={(e) => onUpdateProp('inline', e.target.value === 'inline')}
            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', padding: '2px 4px', fontSize: '0.8rem' }}
          >
            <option value="block">獨立一行 (Block)</option>
            <option value="inline">併排同行 (Inline)</option>
          </select>
        </div>

        {/* Hide Label checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="checkbox"
            id={`hide-label-${field.id}`}
            checked={!!field.hideLabel}
            onChange={(e) => onUpdateProp('hideLabel', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label htmlFor={`hide-label-${field.id}`} style={{ color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>隱藏標題</label>
        </div>
      </div>

      {field.type === 'options' && (
        <div style={{ marginTop: '5px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>選項清單：</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {field.options?.map((opt, i) => (
              <span
                key={i}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  background: getOptionColorStyle(opt.color),
                  borderRadius: '4px',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{opt.value}</span>
                <select
                  value={opt.color || 'default'}
                  onChange={(e) => onUpdateOptionColor(i, e.target.value as any)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: 'none',
                    color: '#fff',
                    fontSize: '0.7rem',
                    borderRadius: '2px',
                    padding: '1px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="default">預設</option>
                  <option value="success">綠(順)</option>
                  <option value="warning">橘(卡)</option>
                  <option value="danger">紅(錯)</option>
                </select>
                <button
                  onClick={() => onDeleteOption(i)}
                  style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="text"
              className="input"
              style={{ padding: '4px 8px', fontSize: '0.8rem', flex: 1 }}
              placeholder="輸入新選項..."
              value={optionInput}
              onChange={(e) => onOptionInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAddOption();
              }}
            />
            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={onAddOption}>
              新增選項
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TemplateManagerWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <TemplateManager />
    </ErrorBoundary>
  );
}
