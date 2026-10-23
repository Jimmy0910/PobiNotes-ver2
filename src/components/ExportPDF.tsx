import { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Printer, ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';

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

interface Mistake {
  id: string;
  title: string;
  chapter_id: string;
  template_id: string;
  chapter_name?: string;
  subject_name?: string;
  template_name?: string;
  template_fields: {
    questionFields: Field[];
    answerFields: Field[];
  };
  data: {
    questionData: { [fieldId: string]: any };
    answerData: { [fieldId: string]: any };
  };
  created_at: number;
}

interface ExportPDFProps {
  mistakeIds: string[];
  onBack: () => void;
  onImageClick?: (src: string) => void;
}

export default function ExportPDF({ mistakeIds, onBack, onImageClick }: ExportPDFProps) {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportMode, setExportMode] = useState<'practice' | 'solution'>('practice');
  const [checkedStates, setCheckedStates] = useState<{ [mistakeId: string]: { [fieldId: string]: string[] } }>({});

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

  const togglePreviewOption = (mistakeId: string, fieldId: string, optionValue: string) => {
    setCheckedStates(prev => {
      const current = prev[mistakeId]?.[fieldId] || [];
      const next = current.includes(optionValue)
        ? current.filter(o => o !== optionValue)
        : [...current, optionValue];
      return {
        ...prev,
        [mistakeId]: {
          ...prev[mistakeId],
          [fieldId]: next
        }
      };
    });
  };

  useEffect(() => {
    const fetchSelectedMistakes = async () => {
      setLoading(true);
      try {
        // Fetch all mistakes and filter client-side to get full records
        const allMistakes: any[] = await apiRequest('/api/mistakes');
        const selected = allMistakes.filter(m => mistakeIds.includes(m.id)).map(m => ({
          ...m,
          template_fields: {
            questionFields: (m.template_fields?.questionFields || []).map(normalizeField),
            answerFields: (m.template_fields?.answerFields || []).map(normalizeField)
          }
        }));
        setMistakes(selected);

        // Initialize checkedStates for preview interaction
        const initialStates: typeof checkedStates = {};
        selected.forEach((m: Mistake) => {
          initialStates[m.id] = {};
          const fields = [...(m.template_fields.questionFields || []), ...(m.template_fields.answerFields || [])];
          fields.forEach(f => {
            if (f.type === 'options') {
              const val = m.data.questionData?.[f.id] || m.data.answerData?.[f.id] || [];
              initialStates[m.id][f.id] = Array.isArray(val) ? val : [];
            }
          });
        });
        setCheckedStates(initialStates);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSelectedMistakes();
  }, [mistakeIds]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Control bar */}
      <div className="glass no-print" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={onBack}>
            <ArrowLeft size={16} /> 返回錯題本
          </button>
          <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>錯題 PDF 匯出預覽</span>
        </div>

        {/* Mode Toggle & Print Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--radius-md)',
            padding: '4px'
          }}>
            <button
              onClick={() => setExportMode('practice')}
              className={`btn`}
              style={{
                padding: '6px 12px',
                fontSize: '0.85rem',
                borderRadius: 'calc(var(--radius-md) - 4px)',
                background: exportMode === 'practice' ? 'var(--accent-gradient)' : 'transparent',
                color: exportMode === 'practice' ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              <EyeOff size={14} /> 練習卷模式
            </button>
            <button
              onClick={() => setExportMode('solution')}
              className={`btn`}
              style={{
                padding: '6px 12px',
                fontSize: '0.85rem',
                borderRadius: 'calc(var(--radius-md) - 4px)',
                background: exportMode === 'solution' ? 'var(--success)' : 'transparent',
                color: exportMode === 'solution' ? '#ffffff' : 'var(--text-secondary)'
              }}
            >
              <Eye size={14} /> 解析卷模式
            </button>
          </div>

          <button className="btn btn-primary" onClick={handlePrint} disabled={mistakes.length === 0}>
            <Printer size={16} /> 列印 / 儲存 PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }} className="no-print">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
          <p style={{ color: 'var(--text-secondary)' }}>載入預覽中...</p>
        </div>
      ) : (
        /* Preview container */
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: '20px 0'
          }}
          // We set class here to allow @media print to target correctly
          className={`print-container ${exportMode === 'practice' ? 'print-practice-mode' : 'print-solution-mode'}`}
        >
          {/* Virtual A4 sheet */}
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: '800px',
              background: '#ffffff',
              color: '#000000',
              padding: '50px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              borderRadius: 'var(--radius-lg)',
              minHeight: '297mm' // A4 Ratio
            }}
            // Overriding glass shadows for printable look inside browser preview
            id="print-sheet-preview"
          >
            {/* Header info */}
            <div style={{ borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '30px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                {exportMode === 'practice' ? '自主練習卷' : '錯題解析整理卷'}
              </h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '0.9rem', color: '#666666' }} className="no-print-data">
                <span>列印日期：{new Date().toLocaleDateString()}</span>
                <span>錯題總數：{mistakes.length} 題</span>
              </div>
            </div>

            {/* Questions List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {mistakes.map((m, index) => (
                <div
                  key={m.id}
                  style={{
                    border: '1px solid #cccccc',
                    borderRadius: '6px',
                    padding: '20px',
                    pageBreakInside: 'avoid'
                  }}
                  className="mistake-card-print"
                >
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', borderBottom: '1px solid #eeeeee', paddingBottom: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>第 {index + 1} 題：{m.title}</span>
                    <span style={{ fontSize: '0.8rem', color: '#888888', fontWeight: 'normal' }}>
                      [{m.subject_name || '無科目'} - {m.chapter_name || '無章節'}]
                    </span>
                  </h3>

                  {/* 1. Question Section */}
                  <div style={{ display: 'block' }}>
                    {m.template_fields.questionFields?.map(field => (
                      <PrintFieldRenderer
                        key={field.id}
                        field={field}
                        value={field.type === 'options' ? (checkedStates[m.id]?.[field.id] || []) : m.data.questionData?.[field.id]}
                        exportMode={exportMode}
                        onOptionToggle={(optVal) => togglePreviewOption(m.id, field.id, optVal)}
                        onImageClick={onImageClick}
                      />
                    ))}
                  </div>

                  {/* 2. Answer Section (Only displayed in solution mode or when printed in solution mode) */}
                  {exportMode === 'solution' && m.template_fields.answerFields && m.template_fields.answerFields.length > 0 && (
                    <div style={{
                      marginTop: '15px',
                      borderTop: '1px dashed #dddddd',
                      paddingTop: '15px',
                      color: 'var(--success)'
                    }} className="answer-section">
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#10b981', marginBottom: '8px' }}>
                        解答與分析：
                      </h4>
                      <div style={{ display: 'block', color: '#000000' }}>
                        {m.template_fields.answerFields.map(field => (
                          <PrintFieldRenderer
                            key={field.id}
                            field={field}
                            value={field.type === 'options' ? (checkedStates[m.id]?.[field.id] || []) : m.data.answerData?.[field.id]}
                            exportMode={exportMode}
                            onOptionToggle={(optVal) => togglePreviewOption(m.id, field.id, optVal)}
                            onImageClick={onImageClick}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>

            {mistakes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px', color: '#888888' }}>
                選中的錯題為空。請先勾選錯題，然後再進行匯出。
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Quick CSS reset override for A4 sheet inside preview mode */}
      <style>{`
        /* Dynamic styles for browser preview sheet */
        #print-sheet-preview {
          border: 1px solid #e2e8f0 !important;
          color: #000000 !important;
        }
        #print-sheet-preview h2, #print-sheet-preview h3, #print-sheet-preview h4 {
          color: #000000 !important;
        }
        #print-sheet-preview p {
          color: #1a202c !important;
        }
      `}</style>

    </div>
  );
}

// Sub-renderer for print values
interface PrintFieldRendererProps {
  field: Field;
  value: any;
  exportMode: 'practice' | 'solution';
  onOptionToggle?: (optionValue: string) => void;
  onImageClick?: (src: string) => void;
}

function PrintFieldRenderer({ field, value, exportMode, onOptionToggle, onImageClick }: PrintFieldRendererProps) {
  const isOptions = field.type === 'options';
  const isUnderline = field.styleType === 'underline';
  const isEmptyValue = value === undefined || value === null || value === '';

  if (isEmptyValue && !isOptions && !isUnderline) {
    return null;
  }

  // 1. Layout styles
  const containerStyle: React.CSSProperties = field.inline ? {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginRight: '24px',
    marginBottom: '10px',
    verticalAlign: 'middle'
  } : {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '12px'
  };

  const labelStyle: React.CSSProperties = field.inline ? {
    fontSize: '0.9rem',
    color: '#333333',
    fontWeight: 'bold',
    margin: 0,
    display: field.hideLabel ? 'none' : 'inline'
  } : {
    fontSize: '0.78rem',
    color: '#666666',
    fontWeight: 'bold',
    marginBottom: '2px',
    display: field.hideLabel ? 'none' : 'block'
  };

  // 2. Option box rendering helpers
  const getOptionBoxStyles = (isChecked: boolean, color?: string) => {
    let textColor = '#000000';
    
    if (color === 'danger') {
      if (isChecked) textColor = '#ef4444';
    } else if (color === 'warning') {
      if (isChecked) textColor = '#f59e0b';
    } else if (color === 'success') {
      if (isChecked) textColor = '#10b981';
    }

    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '0.88rem',
      color: textColor,
      padding: '2px 4px',
      cursor: 'pointer',
      userSelect: 'none' as const
    };
  };

  const renderPrintCheckbox = (isChecked: boolean, color?: string) => {
    let boxBorder = '1px solid #555555';
    let checkColor = '#1d4ed8'; // Hand-drawn blue checkmark
    
    if (color === 'danger') boxBorder = '1px solid #ef4444';
    else if (color === 'warning') boxBorder = '1px solid #f59e0b';
    else if (color === 'success') boxBorder = '1px solid #10b981';

    return (
      <div style={{
        width: '14px',
        height: '14px',
        border: boxBorder,
        borderRadius: '2px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
        position: 'relative'
      }}>
        {isChecked && (
          <span style={{
            color: checkColor,
            fontWeight: 'bold',
            fontSize: '1.15rem',
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
    <div style={containerStyle} className="print-field-card">
      {!field.hideLabel && (
        <span style={labelStyle} className="print-field-label">
          {field.label}：
        </span>
      )}

      {/* Underline Style Rendering */}
      {isUnderline && (field.type === 'text' || field.type === 'textarea') && (
        <span style={{
          borderBottom: '1px solid #000000',
          minWidth: field.inline ? '100px' : '260px',
          display: 'inline-block',
          padding: '0 8px 1px 8px',
          fontSize: '0.95rem',
          color: '#000000',
          wordBreak: 'break-all'
        }}>
          {exportMode === 'practice' ? '\u00A0' : (value || '\u00A0')}
        </span>
      )}

      {/* Normal Bordered Style Text Rendering */}
      {!isUnderline && field.type === 'text' && (
        <p style={{ fontSize: '0.92rem', wordBreak: 'break-word', color: '#000000', margin: 0 }}>
          {value}
        </p>
      )}

      {/* Normal Bordered Style Textarea Rendering */}
      {!isUnderline && field.type === 'textarea' && (
        <p style={{ fontSize: '0.92rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#000000', margin: 0 }}>
          {value}
        </p>
      )}

      {/* Image Rendering */}
      {field.type === 'image' && (
        <div style={{ width: '100%', maxWidth: '380px', marginTop: '4px' }}>
          <img
            src={`/api/images/${value}`}
            alt={field.label}
            onClick={() => onImageClick?.(`/api/images/${value}`)}
            style={{ width: '100%', maxHeight: '250px', objectFit: 'contain', border: '1px solid #dddddd', borderRadius: '4px', cursor: onImageClick ? 'zoom-in' : 'default' }}
          />
        </div>
      )}

      {/* Options (Checkbox Options) Rendering */}
      {field.type === 'options' && (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '10px', verticalAlign: 'middle' }}>
          {field.options?.map((opt, i) => {
            const isChecked = exportMode === 'solution' && Array.isArray(value) && value.includes(opt.value);
            return (
              <span
                key={i}
                onClick={() => onOptionToggle?.(opt.value)}
                style={getOptionBoxStyles(isChecked, opt.color)}
              >
                {renderPrintCheckbox(isChecked, opt.color)}
                <span>{opt.value}</span>
              </span>
            );
          })}
          {(!field.options || field.options.length === 0) && (
            <span style={{ fontSize: '0.82rem', color: '#888888' }}>無選項</span>
          )}
        </div>
      )}
    </div>
  );
}
