import { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../utils/api';
import {
  type CategoriesBundle,
  type FilterState,
  type MistakeRecord,
  extractMistakeTextAndImages,
  filterMistakes,
  formatPct,
  getEffectiveFamiliarityName
} from '../types';
import {
  Sparkles,
  Copy,
  Check,
  Download,
  FileText,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckSquare,
  Square
} from 'lucide-react';

interface PromptTemplateItem {
  id: string;
  base_key?: string | null;
  name: string;
  description: string;
  content: string;
  isBuiltIn?: boolean;
  isModified?: boolean;
  isRecommended?: boolean;
}

const BUILTIN_PROMPT_TEMPLATES: PromptTemplateItem[] = [
  {
    id: 'builtin_gsat_science_recommended',
    base_key: 'gsat_science_recommended',
    name: '學測自然科錯題診斷與思考樹模板',
    description: '最推薦：依台灣學測自然科課綱分類、建立錯題分類表、合併重複考點、分析概念漏洞並輸出思考樹',
    isBuiltIn: true,
    isRecommended: true,
    content: `請扮演一位熟悉台灣學測自然科課綱、錯題診斷與知識分類的專業家教，協助我建立可持續累積的自然科錯題資料庫。

我目前整理了 {{錯題總數}} 道錯題。
科目：{{科目清單}}
章節：{{章節清單}}
單元：{{單元清單}}

熟悉度分布：{{熟悉度分布}}
主要錯因分布：{{主要錯因分布}}

完整錯題資料：
{{錯題完整清單}}

請依照以下規則整理。

## 一、依科目與教材架構分類

將生物與地球科學分開整理，依照「大主題 → 小單元 → 題號」分類。

優先依據我上傳的考卷、答案解析及相關講義，保留原始教材的章節名稱與專業用語，不可只憑題目表面內容分類。

同一單元的多道錯題應集中整理，不要每題都建立一個獨立的大主題。

## 二、建立錯題分類表

每道錯題保留以下欄位：

1. 科目
2. 大主題
3. 小單元
4. 來源考卷或檔案
5. 題號
6. 核心考點
7. 可能的錯誤類型
8. 掌握狀態
9. 建議訂正方向

錯誤類型可分為：基礎概念不清、相似概念混淆、因果關係不清、圖表判讀錯誤、數據判讀錯誤、推理鏈不完整、題幹理解錯誤、選項比較失誤、記憶細節不足。

若缺乏我的作答紀錄或錯誤理由，不可直接認定我有某項漏洞，應標示「待確認」。

## 三、合併重複考點

找出不同題目中重複出現的概念，合併成共同的複習單元。

每個共同考點應列出：
- 涉及題號
- 核心概念
- 容易混淆的觀念
- 應建立的概念連結
- 建議複習優先順序

同時保留各題的特殊條件，避免把不同問題錯誤地歸為同一種漏洞。

## 四、分析概念漏洞

針對重要考點，整理：
- 正確觀念與判斷原則
- 容易出錯的細節
- 概念之間的因果關係
- 下次遇到類似題目的判斷策略

若無法從資料確認錯誤原因，僅提出可能的漏洞，不可將推測寫成已確認事實。

## 五、建立思考樹

必須使用獨立的程式碼區塊，方便我複製保存。

思考樹格式：

自然科錯題
├── 生物
│   └── 大主題
│       ├── 小單元
│       ├── 核心概念
│       ├── 易混淆觀念
│       └── 相關題號
└── 地球科學
    └── 大主題
        ├── 小單元
        ├── 核心概念
        ├── 易混淆觀念
        └── 相關題號

依實際資料增減分支，不可將範例中的單元直接當成每次必然出現的考點。

## 六、學習狀態追蹤

區分以下狀態：
- 已確認漏洞：有作答或推理證據支持。
- 待確認：只有錯題資料，尚不清楚真正原因。
- 已掌握：經過解釋、回想或重新作答後確認。
- 資料不足：缺少題目、解析或必要資訊。

不要因為某題答對就直接判定整個單元已掌握，也不要因為某題答錯就判定整個單元不熟。

## 七、輸出順序

每次依序輸出：

① 錯題總覽
② 生物與地球科學分類
③ 錯題分類表
④ 重複考點整合
⑤ 概念漏洞與訂正方向
⑥ 思考樹（獨立程式碼區塊）
⑦ 學習狀態與複習優先順序

以繁體中文輸出，內容精確、結構清楚，避免不必要的重複。

本模板的首要任務是整理與分類整批錯題，而不是一開始就逐題提問。除非我另外要求，否則不必將每一題都展開成完整解題教學。

若指定題號的原始題目或解析無法取得，請明確標示，不可自行猜測。`
  },
  {
    id: 'builtin_active_recall',
    base_key: 'active_recall',
    name: '主動回想模板',
    description: '遮蔽解答、引導自己逐步回想核心觀念與解題線索的蘇格拉底式提問',
    isBuiltIn: true,
    content: `請扮演一位擅長「主動回想（Active Recall）」與蘇格拉底式引導的家教老師。
我目前整理了 {{錯題總數}} 道錯題（涵蓋科目：{{科目清單}}｜章節：{{章節清單}}｜單元：{{單元清單}}）。

請針對以下錯題，**先不要直接告訴我最終答案**，而是：
1. 針對每道題目的核心觀念提出 2～3 個引導式問題，測試我是否真正理解。
2. 根據我標記的「錯因（{{主要錯因分布}}）」與「熟悉度（{{熟悉度分布}}）」，提醒我作答時最容易踩到的陷阱。
3. 最後再提供結構化的觀念檢核清單。

=== 錯題資料明細 ===
{{錯題完整清單}}`
  },
  {
    id: 'builtin_error_analysis',
    base_key: 'error_analysis',
    name: '錯因分析模板',
    description: '深入剖析錯誤原因（如觀念不清、圖表判讀、忽略條件）並給出具體修正對策',
    isBuiltIn: true,
    content: `請協助我進行「錯題錯因深度診斷」。
本次篩選共 {{錯題總數}} 題，涉及科目：{{科目清單}}，熟悉度分布為：{{熟悉度分布}}，主要錯因分布為：{{主要錯因分布}}。

請根據以下錯題紀錄與我標記的錯因，幫我分析：
1. 這些錯題背後反映出的共同思維盲點或知識斷層是什麼？
2. 針對每個錯因類別（特別是出現頻率最高的原因），制定具體的「解題標準檢查步驟（SOP）」。
3. 設計 2 道同觀念但改變問法的變形練習題，幫助我確認是否已克服該錯因。

=== 錯題資料明細 ===
{{錯題完整清單}}`
  },
  {
    id: 'builtin_chapter_review',
    base_key: 'chapter_review',
    name: '依章節複習模板',
    description: '依科目、章節與單元階層整理重點觀念樹與知識地圖',
    isBuiltIn: true,
    content: `請幫我將以下 {{錯題總數}} 道錯題依照「科目 ➔ 章節 ➔ 單元」階層進行系統化複習整理（目前範圍：{{科目清單}} / {{章節清單}} / {{單元清單}}）。

請輸出：
1. 各章節與單元的核心考點摘要與觀念關聯表。
2. 每道錯題對應的「必備公式／原理」與「常見迷思澄清」。
3. 依照目前熟悉度（{{熟悉度分布}}），排列出建議的複習優先順序。

=== 錯題資料明細 ===
{{錯題完整清單}}`
  },
  {
    id: 'builtin_exam_summary',
    base_key: 'exam_summary',
    name: '考前錯題統整模板',
    description: '濃縮成考前 15 分鐘快速掃描的必考重點、易錯警示與搶分口訣',
    isBuiltIn: true,
    content: `我即將參加考試，請將以下 {{錯題總數}} 道錯題濃縮成一份「考前極速衝刺複習講義」（科目：{{科目清單}}｜錯因統計：{{主要錯因分布}}）。

請包含：
1. 【考前 3 分鐘必看警示】：從我的錯因與「不會／卡」題目中提煉出最關鍵的 5 個避坑提醒。
2. 【觀念對照速記表】：將容易混淆的定義、條件或圖表判讀重點整理成 Markdown 表格。
3. 【逐題一語道破】：用一到兩句話總結每道錯題的破題關鍵。

=== 錯題資料明細 ===
{{錯題完整清單}}`
  },
  {
    id: 'builtin_custom_blank',
    base_key: 'custom_blank',
    name: '完全自訂模板',
    description: '自由編寫提詞結構並插入錯題變數標籤',
    isBuiltIn: true,
    content: `請根據以下我整理的 {{錯題總數}} 道錯題（科目：{{科目清單}}｜章節：{{章節清單}}｜熟悉度：{{熟悉度分布}}｜錯因：{{主要錯因分布}}），協助我整理重點與複習建議：

{{錯題完整清單}}`
  }
];

interface PromptGeneratorProps {
  mistakes: MistakeRecord[];
  categories: CategoriesBundle;
  filter: FilterState;
  preselectedMistakeIds: string[];
}

export default function PromptGenerator({
  mistakes,
  categories,
  filter,
  preselectedMistakeIds
}: PromptGeneratorProps) {
  const filteredMistakes = useMemo(
    () => filterMistakes(mistakes, filter, categories),
    [mistakes, filter, categories]
  );

  // Selected mistake IDs for prompt generation
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (preselectedMistakeIds && preselectedMistakeIds.length > 0) {
      setSelectedIds(preselectedMistakeIds);
    } else {
      setSelectedIds(filteredMistakes.map(m => m.id));
    }
  }, [preselectedMistakeIds, filteredMistakes]);

  // Custom / modified templates from D1
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(BUILTIN_PROMPT_TEMPLATES[0].id);

  // Editable template name & content
  const [templateName, setTemplateName] = useState<string>(BUILTIN_PROMPT_TEMPLATES[0].name);
  const [templateDesc, setTemplateDesc] = useState<string>(BUILTIN_PROMPT_TEMPLATES[0].description);
  const [templateContent, setTemplateContent] = useState<string>(BUILTIN_PROMPT_TEMPLATES[0].content);

  // Final output text (user can also manually edit before copying/exporting)
  const [customEditedOutput, setCustomEditedOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSavedTemplates = async () => {
    try {
      const res = await apiRequest('/api/prompt-templates');
      setSavedTemplates(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSavedTemplates();
  }, []);

  // Merge built-in templates with Copy-on-Write overrides + user custom templates
  const allTemplates: PromptTemplateItem[] = useMemo(() => {
    const mergedBuiltIns = BUILTIN_PROMPT_TEMPLATES.map(b => {
      const override = savedTemplates.find(s => s.base_key === b.base_key);
      if (override) {
        return {
          id: override.id,
          base_key: b.base_key,
          name: override.name,
          description: override.description || b.description,
          content: override.content,
          isBuiltIn: true,
          isModified: true,
          isRecommended: b.isRecommended
        };
      }
      return b;
    });

    const pureCustom = savedTemplates
      .filter(s => !s.base_key)
      .map(s => ({
        id: s.id,
        base_key: null,
        name: s.name,
        description: s.description || '使用者自訂提詞模板',
        content: s.content,
        isBuiltIn: false
      }));

    return [...mergedBuiltIns, ...pureCustom];
  }, [savedTemplates]);

  const handleSelectTemplate = (tpl: PromptTemplateItem) => {
    setActiveTemplateId(tpl.id);
    setTemplateName(tpl.name);
    setTemplateDesc(tpl.description);
    setTemplateContent(tpl.content);
    setCustomEditedOutput(null);
  };

  const selectedMistakes = useMemo(
    () => mistakes.filter(m => selectedIds.includes(m.id)),
    [mistakes, selectedIds]
  );

  // Check image-only or image-containing mistakes (Requirement 9)
  const imageDiagnostics = useMemo(() => {
    const imageOnlyMistakes: MistakeRecord[] = [];
    const withImageMistakes: MistakeRecord[] = [];

    selectedMistakes.forEach(m => {
      const ext = extractMistakeTextAndImages(m);
      if (ext.hasQuestionImage || ext.hasAnswerImage) {
        withImageMistakes.push(m);
      }
      if (ext.isImageOnlyQuestion) {
        imageOnlyMistakes.push(m);
      }
    });

    return { imageOnlyMistakes, withImageMistakes };
  }, [selectedMistakes]);

  // Safe pure-code template interpolation (Requirement 9 & 11: never use eval or Function)
  const generatedPrompt = useMemo(() => {
    const count = selectedMistakes.length;
    const subjectsSet = new Set<string>();
    const chaptersSet = new Set<string>();
    const unitsSet = new Set<string>();
    const famCounts: Record<string, number> = {};
    const reasonCounts: Record<string, number> = {};

    selectedMistakes.forEach(m => {
      subjectsSet.add(m.subject_name || '未分類科目');
      chaptersSet.add(m.chapter_name || '未分類章節');
      if (m.unit_name) unitsSet.add(m.unit_name);

      const famName = getEffectiveFamiliarityName(m, categories.familiarities) || '尚未設定熟悉度';
      famCounts[famName] = (famCounts[famName] || 0) + 1;

      const rNames = Array.isArray(m.error_reason_names) && m.error_reason_names.length > 0
        ? m.error_reason_names
        : ['未標記錯因'];
      rNames.forEach(rn => {
        reasonCounts[rn] = (reasonCounts[rn] || 0) + 1;
      });
    });

    const subjectListStr = Array.from(subjectsSet).join('、') || '無';
    const chapterListStr = Array.from(chaptersSet).join('、') || '無';
    const unitListStr = Array.from(unitsSet).join('、') || '無指定單元';

    const famDistStr = Object.entries(famCounts)
      .map(([k, v]) => `${k} ${v} 題 (${formatPct(v, count)})`)
      .join('、') || '尚無資料';

    const reasonDistStr = Object.entries(reasonCounts)
      .map(([k, v]) => `${k} ${v} 題 (${formatPct(v, count)})`)
      .join('、') || '尚無資料';

    const detailsBlocks = selectedMistakes.map((m, idx) => {
      const ext = extractMistakeTextAndImages(m);
      const famName = getEffectiveFamiliarityName(m, categories.familiarities) || '尚未設定';
      const reasonsStr = (m.error_reason_names && m.error_reason_names.length > 0)
        ? m.error_reason_names.join('、')
        : '未標記';
      const tagsStr = (m.tags && m.tags.length > 0) ? m.tags.join('、') : '無';

      const questionBody = ext.isImageOnlyQuestion
        ? '[注意：此題目僅有圖片而無題目文字，純文字提詞未包含圖片內容，請在對話中附上題目圖片或補充文字敘述]'
        : (ext.questionText || '（無題目文字）') + (ext.hasQuestionImage ? '\n[提示：此題另附有題目圖片，未包含於純文字提詞中]' : '');

      const answerBody = (ext.answerText || '（無文字解析）') +
        (ext.hasAnswerImage ? '\n[提示：此題另附有解析圖片，未包含於純文字提詞中]' : '');

      return [
        `【第 ${idx + 1} 題】${m.title}`,
        `- 分類：科目「${m.subject_name || '未分類'}」＞ 章節「${m.chapter_name || '未分類'}」${m.unit_name ? `＞ 單元「${m.unit_name}」` : ''}`,
        `- 熟悉度：${famName} ｜ 錯因：${reasonsStr} ｜ 日期：${m.mistake_date || new Date(m.created_at).toLocaleDateString()} ｜ 標籤：${tagsStr}`,
        `- 題目內容：\n${questionBody}`,
        `- 答案與解析：\n${answerBody}`
      ].join('\n');
    }).join('\n\n----------------------------------------\n\n');

    const replacements: Record<string, string> = {
      '{{錯題總數}}': String(count),
      '{{科目清單}}': subjectListStr,
      '{{章節清單}}': chapterListStr,
      '{{單元清單}}': unitListStr,
      '{{熟悉度分布}}': famDistStr,
      '{{主要錯因分布}}': reasonDistStr,
      '{{錯題完整清單}}': detailsBlocks || '（尚未勾選任何錯題）'
    };

    let output = templateContent;
    for (const [token, val] of Object.entries(replacements)) {
      output = output.split(token).join(val);
    }

    if (!templateContent.includes('{{錯題完整清單}}') && detailsBlocks) {
      output += `\n\n=== 錯題資料明細 ===\n${detailsBlocks}`;
    }

    return output;
  }, [selectedMistakes, templateContent, categories.familiarities]);

  const effectiveOutput = customEditedOutput !== null ? customEditedOutput : generatedPrompt;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(effectiveOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via textarea
      const ta = document.createElement('textarea');
      ta.value = effectiveOutput;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadFile = (ext: 'txt' | 'md') => {
    const mime = ext === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([effectiveOutput], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `PobiNotes_${templateName || 'AI提詞'}_${dateStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveCurrentTemplate = async (saveAsNew: boolean) => {
    if (!templateName.trim() || !templateContent.trim()) {
      alert('請填寫模板名稱與提詞模板內容');
      return;
    }
    setSaving(true);
    try {
      const currentTpl = allTemplates.find(t => t.id === activeTemplateId);
      if (saveAsNew) {
        const newName = templateName.trim().endsWith('(自訂副本)')
          ? templateName.trim()
          : `${templateName.trim()} (自訂)`;
        const res = await apiRequest('/api/prompt-templates', {
          method: 'POST',
          body: {
            baseKey: null,
            name: newName,
            description: templateDesc,
            content: templateContent
          }
        });
        await fetchSavedTemplates();
        if (res.template?.id) {
          setActiveTemplateId(res.template.id);
          setTemplateName(res.template.name);
        }
      } else if (currentTpl?.isBuiltIn) {
        // Copy-on-Write override for built-in template
        const res = await apiRequest('/api/prompt-templates', {
          method: 'POST',
          body: {
            baseKey: currentTpl.base_key,
            name: templateName.trim(),
            description: templateDesc,
            content: templateContent
          }
        });
        await fetchSavedTemplates();
        if (res.template?.id) {
          setActiveTemplateId(res.template.id);
        }
      } else if (currentTpl) {
        await apiRequest('/api/prompt-templates', {
          method: 'PUT',
          body: {
            id: currentTpl.id,
            name: templateName.trim(),
            description: templateDesc,
            content: templateContent
          }
        });
        await fetchSavedTemplates();
      }
    } catch (e: any) {
      alert(e.message || '儲存提詞模板失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSavedTemplate = async (tpl: PromptTemplateItem) => {
    if (!confirm(`確定要${tpl.isBuiltIn ? '還原此預設模板' : '刪除此自訂模板'}嗎？`)) return;
    try {
      await apiRequest(`/api/prompt-templates?id=${tpl.id}`, { method: 'DELETE' });
      await fetchSavedTemplates();
      handleSelectTemplate(BUILTIN_PROMPT_TEMPLATES[0]);
    } catch (e: any) {
      alert(e.message || '刪除失敗');
    }
  };

  const toggleMistakeSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    setCustomEditedOutput(null);
  };

  const insertVariableToken = (token: string) => {
    setTemplateContent(prev => `${prev}${token}`);
    setCustomEditedOutput(null);
  };

  return (
    <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }} className="animate-fade-in">
      {/* Header */}
      <div className="glass" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} style={{ color: 'var(--accent-primary)' }} />
            <span>純程式碼外部 AI 提詞產生器</span>
          </h2>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            根據目前篩選與勾選的真實錯題資料，搭配可編輯模板動態合成提詞文字（不呼叫任何 AI API，100% 離線安全組合）。
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.88rem' }}
            onClick={handleCopy}
            data-testid="copy-prompt-btn"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? '已複製到剪貼簿！' : '複製完整提詞'}</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.88rem' }}
            onClick={() => handleDownloadFile('txt')}
            data-testid="download-txt-btn"
          >
            <Download size={16} /> 下載 TXT
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.88rem' }}
            onClick={() => handleDownloadFile('md')}
            data-testid="download-md-btn"
          >
            <FileText size={16} /> 匯出 Markdown
          </button>
        </div>
      </div>

      {/* Explicit Image-Only Warning Banner (Requirement 9) */}
      {imageDiagnostics.withImageMistakes.length > 0 && (
        <div className="warning-alert-banner animate-fade-in" data-testid="image-only-warning-banner">
          <AlertTriangle size={20} />
          <div style={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
            <strong>圖片內容未包含於純文字提詞提醒：</strong>
            <span>
              您目前勾選的錯題中，有 {imageDiagnostics.withImageMistakes.length} 題包含圖片
              {imageDiagnostics.imageOnlyMistakes.length > 0 && (
                <strong>（其中 {imageDiagnostics.imageOnlyMistakes.length} 題「只有題目圖片而沒有題目文字」：{imageDiagnostics.imageOnlyMistakes.map(m => m.title).join('、')}）</strong>
              )}
              。純文字提詞不會自動辨識或轉換圖片內容，系統已在對應題目處加入明確標註，貼給外部 AI 時請一併附上原圖或補充文字描述。
            </span>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-2" style={{ gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Mistake Selector + Template Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. Template Selector & Editor */}
          <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>1. 選擇與編輯提詞模板</h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allTemplates.map(tpl => {
                const isSelected = activeTemplateId === tpl.id;
                return (
                  <div key={tpl.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        border: !isSelected && tpl.isRecommended ? '1px solid var(--warning-border)' : undefined
                      }}
                      data-testid={`prompt-tpl-btn-${tpl.name}`}
                    >
                      {tpl.isRecommended && (
                        <span className="badge-recommended-tag">
                          最推薦
                        </span>
                      )}
                      <span>{tpl.name}</span>
                    </button>
                    {(!tpl.isBuiltIn || tpl.isModified) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedTemplate(tpl)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                        title={tpl.isBuiltIn ? '還原預設模板' : '刪除自訂模板'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">模板名稱（可自由修改）</label>
              <input
                type="text"
                className="input"
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                data-testid="prompt-template-name-input"
              />
            </div>

            {/* Variable insertion chips */}
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                點擊插入動態變數標籤：
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[
                  '{{錯題總數}}',
                  '{{科目清單}}',
                  '{{章節清單}}',
                  '{{單元清單}}',
                  '{{熟悉度分布}}',
                  '{{主要錯因分布}}',
                  '{{錯題完整清單}}'
                ].map(token => (
                  <button
                    key={token}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    onClick={() => insertVariableToken(token)}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">模板內容結構</label>
              <textarea
                className="input"
                rows={7}
                style={{ fontSize: '0.86rem', lineHeight: 1.5, fontFamily: 'monospace' }}
                value={templateContent}
                onChange={e => {
                  setTemplateContent(e.target.value);
                  setCustomEditedOutput(null);
                }}
                data-testid="prompt-template-content-input"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                onClick={() => handleSaveCurrentTemplate(false)}
                disabled={saving}
              >
                <Save size={14} /> 儲存模板修改
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                onClick={() => handleSaveCurrentTemplate(true)}
                disabled={saving}
                data-testid="save-as-new-prompt-tpl-btn"
              >
                <Plus size={14} /> 另存為新模板
              </button>
            </div>
          </div>

          {/* 2. Mistake Selection List */}
          <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                2. 勾選要納入提詞的錯題 ({selectedIds.length} / {filteredMistakes.length} 題)
              </h3>
              <button
                type="button"
                className="btn btn-text"
                style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                onClick={() => {
                  if (selectedIds.length === filteredMistakes.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(filteredMistakes.map(m => m.id));
                  }
                  setCustomEditedOutput(null);
                }}
              >
                {selectedIds.length === filteredMistakes.length ? '取消全選' : '全選篩選結果'}
              </button>
            </div>

            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredMistakes.map(m => {
                const checked = selectedIds.includes(m.id);
                const ext = extractMistakeTextAndImages(m);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleMistakeSelection(m.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: checked ? 'rgba(99, 102, 241, 0.12)' : 'var(--glass-bg)',
                      border: `1px solid ${checked ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    {checked ? (
                      <CheckSquare size={17} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    ) : (
                      <Square size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{m.title}</span>
                        {ext.isImageOnlyQuestion && (
                          <span className="badge-warning-contrast">
                            純圖片題
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {m.subject_name || '未分類'} / {m.chapter_name || '未分類'}
                        {m.unit_name ? ` / ${m.unit_name}` : ''} ｜ 熟悉度：{m.familiarity_name || '未設定'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredMistakes.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                  目前篩選範圍內沒有錯題。
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Live Preview & Direct Editing of Generated Prompt */}
        <div className="glass" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>3. 提詞即時預覽與微調編輯</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                可直接於下方文字框微調最終文字，再點擊上方複製或匯出 TXT / Markdown
              </p>
            </div>
            {customEditedOutput !== null && (
              <button
                type="button"
                className="btn btn-text"
                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                onClick={() => setCustomEditedOutput(null)}
              >
                還原自動產生內容
              </button>
            )}
          </div>

          <textarea
            className="input"
            rows={24}
            style={{
              width: '100%',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
            value={effectiveOutput}
            onChange={e => setCustomEditedOutput(e.target.value)}
            data-testid="generated-prompt-preview"
          />
        </div>
      </div>
    </div>
  );
}
