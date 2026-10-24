import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../utils/api';
import {
  Printer,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  FileDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Trash2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

  // PDF Generation & 1-Minute Temporary Cache States
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfProgressText, setPdfProgressText] = useState('');
  const [cachedPdfUrl, setCachedPdfUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfExpireTime, setPdfExpireTime] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [pdfExpired, setPdfExpired] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const cachedBlobRef = useRef<Blob | null>(null);

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

  // 1-minute (60s) Countdown & Cache Disposal Timer
  useEffect(() => {
    if (!pdfExpireTime || !cachedPdfUrl) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((pdfExpireTime - Date.now()) / 1000));
      setCountdownSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        if (cachedPdfUrl) {
          URL.revokeObjectURL(cachedPdfUrl);
        }
        setCachedPdfUrl(null);
        cachedBlobRef.current = null;
        setPdfExpired(true);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [pdfExpireTime, cachedPdfUrl]);

  // Revoke object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (cachedPdfUrl) {
        URL.revokeObjectURL(cachedPdfUrl);
      }
    };
  }, [cachedPdfUrl]);

  const handleClearCache = () => {
    if (cachedPdfUrl) {
      URL.revokeObjectURL(cachedPdfUrl);
    }
    setCachedPdfUrl(null);
    cachedBlobRef.current = null;
    setPdfExpireTime(null);
    setPdfExpired(false);
    setCountdownSeconds(0);
  };

  const handleGeneratePdf = async () => {
    const element = document.getElementById('print-sheet-preview');
    if (!element) return;

    setIsGenerating(true);
    setPdfProgressText('準備頁面素材...');
    setPdfError(null);
    setPdfExpired(false);

    // 清除舊的暫存 URL
    if (cachedPdfUrl) {
      URL.revokeObjectURL(cachedPdfUrl);
      setCachedPdfUrl(null);
      cachedBlobRef.current = null;
    }

    try {
      // 確保所有預覽圖片載入完成
      const images = Array.from(element.querySelectorAll('img'));
      if (images.length > 0) {
        setPdfProgressText('載入題目圖檔中...');
        await Promise.all(
          images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );
      }

      setPdfProgressText('渲染高畫質 A4 紙張中...');
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      setPdfProgressText('編譯 PDF 檔案...');
      const imgWidth = 210; // A4 寬度 (mm)
      const pageHeight = 297; // A4 高度 (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      // 第一頁
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // 若高度超出單頁，依序加頁
      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const pdfBlob = pdf.output('blob');
      cachedBlobRef.current = pdfBlob;
      const blobUrl = URL.createObjectURL(pdfBlob);

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const modeText = exportMode === 'practice' ? '自主練習卷' : '錯題解析卷';
      const fileName = `PobiNotes_${modeText}_${dateStr}.pdf`;

      setCachedPdfUrl(blobUrl);
      setPdfFileName(fileName);
      setPdfExpireTime(Date.now() + 60 * 1000); // 暫存 1 分鐘 (60 秒)
      setCountdownSeconds(60);
      setPdfExpired(false);
    } catch (err: any) {
      console.error('PDF 生成失敗：', err);
      setPdfError(err.message || '建立 PDF 失敗，請重試或改用原生列印。');
    } finally {
      setIsGenerating(false);
      setPdfProgressText('');
    }
  };

  const handleDownloadPdf = () => {
    if (!cachedPdfUrl) return;
    const link = document.createElement('a');
    link.href = cachedPdfUrl;
    link.download = pdfFileName || 'PobiNotes_錯題卷.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        {/* Mode Toggle, PDF Builder & Print Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

          {/* 建立 PDF (暫存 1 分鐘下載) 按鈕 */}
          <button
            className="btn btn-primary"
            onClick={handleGeneratePdf}
            disabled={isGenerating || mistakes.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>建立 PDF 中...</span>
              </>
            ) : (
              <>
                <FileDown size={16} />
                <span>建立 PDF (暫存 1 分鐘)</span>
              </>
            )}
          </button>

          {/* 原生列印按鈕 (保留備用) */}
          <button
            className="btn btn-secondary"
            onClick={handlePrint}
            disabled={mistakes.length === 0}
            title="開啟瀏覽器原生列印視窗"
            style={{ padding: '8px 12px' }}
          >
            <Printer size={15} /> 原生列印
          </button>
        </div>
      </div>

      {/* Temporary PDF Cache & Status Card */}
      {isGenerating && (
        <div className="glass no-print animate-fade-in" style={{
          padding: '16px 20px',
          borderLeft: '4px solid var(--accent-primary)',
          background: 'rgba(0, 31, 101, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>正在網頁上建立高畫質 PDF...</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              進度：{pdfProgressText || '處理中，請稍候'}
            </div>
          </div>
        </div>
      )}

      {cachedPdfUrl && !isGenerating && (
        <div className="glass no-print animate-fade-in" style={{
          padding: '18px 24px',
          borderLeft: '4px solid var(--success)',
          background: 'rgba(25, 122, 39, 0.08)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  PDF 文件已在網頁建立完成！
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  檔案名稱：<code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '4px' }}>{pdfFileName}</code>（暫存於瀏覽器記憶體，限時 1 分鐘）
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* 倒數計時膠囊 */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '20px',
                background: countdownSeconds <= 15 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(25, 122, 39, 0.15)',
                color: countdownSeconds <= 15 ? 'var(--danger)' : 'var(--success)',
                fontWeight: 700,
                fontSize: '0.88rem'
              }}>
                <Clock size={15} />
                <span>剩餘 {countdownSeconds} 秒自動清除</span>
              </div>

              {/* 下載按鈕 */}
              <button
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                style={{
                  background: 'var(--success)',
                  color: '#ffffff',
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(25, 122, 39, 0.25)'
                }}
              >
                <FileDown size={17} /> 立即下載 PDF
              </button>

              <button
                className="btn btn-text"
                onClick={handleClearCache}
                title="手動清除此暫存"
                style={{ padding: '8px', color: 'var(--text-muted)' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* 倒數計時進度條 */}
          <div style={{ width: '100%', height: '5px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.max(0, (countdownSeconds / 60) * 100)}%`,
              background: countdownSeconds <= 15 ? 'var(--danger)' : 'var(--success)',
              transition: 'width 0.5s linear, background-color 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {pdfExpired && !cachedPdfUrl && !isGenerating && (
        <div className="glass no-print animate-fade-in" style={{
          padding: '14px 20px',
          borderLeft: '4px solid var(--warning-border)',
          background: 'var(--warning-bg)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning-border)' }} />
            <span style={{ fontSize: '0.88rem', color: 'var(--warning-text)', fontWeight: 500 }}>
              暫存 PDF 已逾 1 分鐘，並已自動銷毀以釋放資源。如需下載，請再次點擊「建立 PDF」。
            </span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleGeneratePdf}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            <RotateCcw size={14} /> 重新建立 PDF
          </button>
        </div>
      )}

      {pdfError && (
        <div className="glass no-print animate-fade-in" style={{
          padding: '14px 20px',
          borderLeft: '4px solid var(--danger)',
          background: 'rgba(239, 68, 68, 0.08)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: '0.88rem', color: 'var(--danger)' }}>{pdfError}</span>
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleGeneratePdf}
            style={{ padding: '6px 12px', fontSize: '0.84rem' }}
          >
            重試
          </button>
        </div>
      )}

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
