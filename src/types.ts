export type CategoryDimension = 'subject' | 'chapter' | 'unit' | 'familiarity' | 'error_reason';

export interface CategoryItem {
  id: string;
  dimension: CategoryDimension;
  parent_id: string | null;
  subject_id?: string | null;
  name: string;
  color: 'default' | 'success' | 'warning' | 'danger' | string;
  sort_order: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  mistake_count: number;
}

export interface CategoriesBundle {
  items: CategoryItem[];
  subjects: CategoryItem[];
  chapters: CategoryItem[];
  units: CategoryItem[];
  familiarities: CategoryItem[];
  errorReasons: CategoryItem[];
  errorReasonMode: 'multi' | 'single';
}

export interface FieldOption {
  value: string;
  color?: 'default' | 'danger' | 'warning' | 'success';
}

export interface Field {
  id: string;
  type: 'text' | 'textarea' | 'image' | 'options';
  label: string;
  options?: FieldOption[];
  styleType?: 'bordered' | 'underline';
  inline?: boolean;
  hideLabel?: boolean;
}

export interface MistakeRecord {
  id: string;
  user_id?: string;
  title: string;
  subject_id: string | null;
  chapter_id: string | null;
  unit_id: string | null;
  familiarity_id: string | null;
  error_reason_ids: string[];
  error_reason_items?: Array<{ id: string; name: string; color: string; is_active: number }>;
  error_reason_names?: string[];
  tags: string[];
  mistake_date: string;
  template_id: string;
  subject_name?: string | null;
  subject_is_active?: number;
  chapter_name?: string | null;
  chapter_is_active?: number;
  unit_name?: string | null;
  unit_is_active?: number;
  familiarity_name?: string | null;
  familiarity_color?: string | null;
  familiarity_is_active?: number;
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
  updated_at?: number;
}

export interface FilterState {
  subjectIds: string[];      // can include '__UNCATEGORIZED__'
  chapterIds: string[];      // can include '__UNCATEGORIZED__'
  unitIds: string[];         // can include '__UNCATEGORIZED__'
  familiarityIds: string[];  // can include '__UNCATEGORIZED__'
  errorReasonIds: string[];  // can include '__UNCATEGORIZED__'
  tags: string[];
  fromDate: string;
  toDate: string;
  keyword: string;
}

export const UNCATEGORIZED_ID = '__UNCATEGORIZED__';

export function createEmptyFilterState(): FilterState {
  return {
    subjectIds: [],
    chapterIds: [],
    unitIds: [],
    familiarityIds: [],
    errorReasonIds: [],
    tags: [],
    fromDate: '',
    toDate: '',
    keyword: ''
  };
}

export function formatPct(numerator: number, denominator: number, decimals = 1): string {
  if (!denominator || denominator <= 0 || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return '0.0%';
  }
  const pct = (numerator / denominator) * 100;
  if (!Number.isFinite(pct)) return '0.0%';
  return `${pct.toFixed(decimals)}%`;
}

export function getEffectiveFamiliarityName(m: MistakeRecord, familiarities: CategoryItem[]): string | null {
  if (m.familiarity_id) {
    const found = familiarities.find(f => f.id === m.familiarity_id);
    if (found) return found.name;
  }
  if (m.familiarity_name) return m.familiarity_name;

  // Fallback to legacy template field if any
  const values: string[] = [];
  for (const sec of [m.data?.answerData, m.data?.questionData]) {
    if (sec && typeof sec === 'object') {
      for (const [k, v] of Object.entries(sec)) {
        if (k.includes('mastery') && Array.isArray(v)) {
          values.push(...v);
        }
      }
    }
  }
  if (values.length > 0) {
    return values[0] === '會' ? '順' : values[0];
  }
  return null;
}

export function getEffectiveFamiliarityId(m: MistakeRecord, familiarities: CategoryItem[]): string | null {
  if (m.familiarity_id && familiarities.some(f => f.id === m.familiarity_id)) {
    return m.familiarity_id;
  }
  const name = getEffectiveFamiliarityName(m, familiarities);
  if (name) {
    const found = familiarities.find(f => f.name === name || (name === '會' && f.name === '順'));
    if (found) return found.id;
  }
  return null;
}

export const DEFAULT_TEMPLATE_FIELDS: {
  questionFields: Field[];
  answerFields: Field[];
} = {
  questionFields: [
    { id: 'q_text', label: '題目說明 (選填)', type: 'textarea' },
    { id: 'q_img', label: '題目圖片', type: 'image' },
    { id: 'q_source', label: '題目來源 (如：112學測)', type: 'text' }
  ],
  answerFields: [
    { id: 'a_mastery', label: '掌握度', type: 'options' },
    { id: 'a_ans', label: '正確答案与詳解文字', type: 'textarea' },
    { id: 'a_img', label: '詳解圖片', type: 'image' },
    { id: 'a_note', label: '個人筆記 / 破題關鍵', type: 'textarea' }
  ]
};

export function extractMistakeTextAndImages(m: MistakeRecord): {
  questionText: string;
  answerText: string;
  hasQuestionImage: boolean;
  hasAnswerImage: boolean;
  isImageOnlyQuestion: boolean;
} {
  const qLines: string[] = [];
  const aLines: string[] = [];
  let hasQuestionImage = false;
  let hasAnswerImage = false;

  const qFields = m.template_fields?.questionFields?.length
    ? m.template_fields.questionFields
    : DEFAULT_TEMPLATE_FIELDS.questionFields;
  const aFields = m.template_fields?.answerFields?.length
    ? m.template_fields.answerFields
    : DEFAULT_TEMPLATE_FIELDS.answerFields;

  const qData: Record<string, any> = m.data?.questionData || (m.data as any) || {};
  const aData: Record<string, any> = m.data?.answerData || (m.data as any) || {};

  for (const f of qFields) {
    const val = qData[f.id];
    if (f.type === 'image') {
      if (val && typeof val === 'string' && val.trim() !== '') {
        hasQuestionImage = true;
      }
    } else if (f.type === 'text' || f.type === 'textarea') {
      if (val && typeof val === 'string' && val.trim() !== '') {
        qLines.push(`${f.label ? f.label + '：' : ''}${val.trim()}`);
      }
    } else if (f.type === 'options') {
      if (Array.isArray(val) && val.length > 0) {
        qLines.push(`${f.label ? f.label + '：' : ''}${val.join('、')}`);
      }
    }
  }

  // Also check extra fallback keys in case raw keys (q_image, a_text, a_analysis) were stored
  if (!hasQuestionImage && typeof qData.q_image === 'string' && qData.q_image.trim() !== '') {
    hasQuestionImage = true;
  }

  for (const f of aFields) {
    if (f.id.includes('mastery') || f.label === '掌握度') continue;
    const val = aData[f.id];
    if (f.type === 'image') {
      if (val && typeof val === 'string' && val.trim() !== '') {
        hasAnswerImage = true;
      }
    } else if (f.type === 'text' || f.type === 'textarea') {
      if (val && typeof val === 'string' && val.trim() !== '') {
        aLines.push(`${f.label ? f.label + '：' : ''}${val.trim()}`);
      }
    } else if (f.type === 'options') {
      if (Array.isArray(val) && val.length > 0) {
        aLines.push(`${f.label ? f.label + '：' : ''}${val.join('、')}`);
      }
    }
  }

  if (typeof aData.a_text === 'string' && aData.a_text.trim() !== '') {
    aLines.push(`正確答案：${aData.a_text.trim()}`);
  }
  if (typeof aData.a_analysis === 'string' && aData.a_analysis.trim() !== '') {
    aLines.push(`詳解分析：${aData.a_analysis.trim()}`);
  }
  if (!hasAnswerImage && typeof aData.a_image === 'string' && aData.a_image.trim() !== '') {
    hasAnswerImage = true;
  }

  const questionText = qLines.join('\n').trim();
  const answerText = aLines.join('\n').trim();
  const isImageOnlyQuestion = questionText === '' && hasQuestionImage;

  return {
    questionText,
    answerText,
    hasQuestionImage,
    hasAnswerImage,
    isImageOnlyQuestion
  };
}

export function filterMistakes(
  mistakes: MistakeRecord[],
  filter: FilterState,
  categories: CategoriesBundle
): MistakeRecord[] {
  return mistakes.filter(m => {
    // 1. Subject filter
    if (filter.subjectIds.length > 0) {
      const sId = m.subject_id || UNCATEGORIZED_ID;
      if (!filter.subjectIds.includes(sId)) return false;
    }

    // 2. Chapter filter
    if (filter.chapterIds.length > 0) {
      const cId = m.chapter_id || UNCATEGORIZED_ID;
      if (!filter.chapterIds.includes(cId)) return false;
    }

    // 3. Unit filter
    if (filter.unitIds.length > 0) {
      const uId = m.unit_id || UNCATEGORIZED_ID;
      if (!filter.unitIds.includes(uId)) return false;
    }

    // 4. Familiarity filter
    if (filter.familiarityIds.length > 0) {
      const fId = getEffectiveFamiliarityId(m, categories.familiarities) || UNCATEGORIZED_ID;
      if (!filter.familiarityIds.includes(fId)) return false;
    }

    // 5. Error Reason filter (multi-value match: matches if mistake has ANY of the selected error reasons, or UNCATEGORIZED if empty)
    if (filter.errorReasonIds.length > 0) {
      const rIds = Array.isArray(m.error_reason_ids) && m.error_reason_ids.length > 0
        ? m.error_reason_ids
        : [UNCATEGORIZED_ID];
      const matchesReason = rIds.some(id => filter.errorReasonIds.includes(id));
      if (!matchesReason) return false;
    }

    // 6. Custom Tags filter
    if (filter.tags.length > 0) {
      const mTags = Array.isArray(m.tags) ? m.tags : [];
      const matchesTag = filter.tags.some(t => mTags.includes(t));
      if (!matchesTag) return false;
    }

    // 7. Date range filter
    const mDateStr = m.mistake_date || new Date(m.created_at).toISOString().slice(0, 10);
    if (filter.fromDate && mDateStr < filter.fromDate) {
      return false;
    }
    if (filter.toDate && mDateStr > filter.toDate) {
      return false;
    }

    // 8. Keyword search
    if (filter.keyword.trim() !== '') {
      const kw = filter.keyword.trim().toLowerCase();
      const titleMatch = (m.title || '').toLowerCase().includes(kw);
      const subjMatch = (m.subject_name || '').toLowerCase().includes(kw);
      const chapMatch = (m.chapter_name || '').toLowerCase().includes(kw);
      const unitMatch = (m.unit_name || '').toLowerCase().includes(kw);
      const tagMatch = (m.tags || []).some(t => t.toLowerCase().includes(kw));
      const reasonMatch = (m.error_reason_names || []).some(r => r.toLowerCase().includes(kw));

      let contentMatch = false;
      for (const sec of [m.data?.questionData, m.data?.answerData]) {
        if (sec && typeof sec === 'object') {
          if (Object.values(sec).some(v => typeof v === 'string' && v.toLowerCase().includes(kw))) {
            contentMatch = true;
            break;
          }
        }
      }

      if (!titleMatch && !subjMatch && !chapMatch && !unitMatch && !tagMatch && !reasonMatch && !contentMatch) {
        return false;
      }
    }

    return true;
  });
}
