import { useState } from 'react';
import { 
  Folder, 
  Settings, 
  PlusCircle, 
  Filter, 
  FileText, 
  MessageSquare, 
  Shield, 
  BookOpen,
  ChevronRight,
  HelpCircle,
  Info,
  CheckCircle2
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  description: string;
}

export default function UsageGuide() {
  const [activeTab, setActiveTab] = useState<string>('overview');

  const sections: GuideSection[] = [
    { id: 'overview', title: '系統總覽', icon: BookOpen, description: '了解核心概念與設計初衷' },
    { id: 'subjects', title: '科目與章節管理', icon: Folder, description: '如何建立、編輯與規劃您的學科結構' },
    { id: 'templates', title: '自訂模板設計', icon: Settings, description: '量身打造適合各學科的錯題欄位版面' },
    { id: 'mistakes', title: '錯題新增與圖片', icon: PlusCircle, description: '新增錯題、上傳圖片與填寫自訂欄位' },
    { id: 'filtering', title: '題目篩選系統', icon: Filter, description: '使用關鍵字、日期與難度交叉篩選題目' },
    { id: 'exporting', title: '匯出', icon: FileText, description: '批次選取錯題並匯出成無答案的練習本' },
    { id: 'feedback', title: '意見與評價回饋', icon: MessageSquare, description: '與我們分享您的使用體驗以持續改進' },
    { id: 'admin', title: '管理員系統', icon: Shield, description: '單一管理員註冊限制與後台管理功能說明' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                background: 'var(--accent-gradient)',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <HelpCircle size={24} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>歡迎使用錯題本！</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>專為學生與學習者設計的數位化錯題整理與複習工具</p>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
              在學習的過程中，「從錯誤中學習」是最有效率的進步方式。本系統旨在幫助您整理各科目的錯題，並透過自訂欄位、標籤與快速搜尋，建立最適合您步調的複習資料庫。
            </p>

            <div style={{
              background: 'var(--glass-highlight)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              marginTop: '10px'
            }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                <Info size={18} /> 快速上手四步驟：
              </h3>
              <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.92rem' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>建立科目與章節</strong>：在左側側邊欄規劃您的學習大綱（如：數學 - 第一章 函數）。
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>設計自訂模板</strong>：針對不同的學科特性（如：英文單字、數學計算題）規劃輸入欄位。
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>整理您的錯題</strong>：填寫題目敘述、上傳題目或手寫解析照片，並為其標註難度。
                </li>
                <li>
                  <strong style={{ color: 'var(--text-primary)' }}>篩選與匯出複習</strong>：利用篩選系統找出特定難度的錯題，批次匯出，重新列印練習！
                </li>
              </ol>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginTop: '16px' }}>
              <div className="glass-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setActiveTab('subjects')}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.95rem' }}>
                  <Folder size={18} style={{ color: 'var(--accent-primary)' }} /> 科目管理
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  學習如何使用側邊欄自由新增、修改與刪除您的學科與章節目錄。
                </p>
              </div>
              <div className="glass-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setActiveTab('templates')}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.95rem' }}>
                  <Settings size={18} style={{ color: 'var(--accent-primary)' }} /> 模板設計
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  不同學科需要不同的欄位。學習如何新增文字、圖片與單選選項欄位。
                </p>
              </div>
              <div className="glass-card" style={{ padding: '16px', cursor: 'pointer' }} onClick={() => setActiveTab('exporting')}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '0.95rem' }}>
                  <FileText size={18} style={{ color: 'var(--accent-primary)' }} /> 匯出複習本
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  一次勾選多個錯題，隱藏答案與解析快速列印成乾淨的實體考卷。
                </p>
              </div>
            </div>
          </div>
        );

      case 'subjects':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <Folder size={24} /> 科目與章節管理
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              此系統採用「科目 &gt; 章節 &gt; 錯題」的三層式結構。您可以透過側邊欄隨時維護您的學科分類：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>建立學科</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    點擊側邊欄「學科分類」標題右側的 <strong>+</strong> 按鈕，在出現的輸入框中鍵入您的學科名稱（例如：數學、化學、英文），然後點擊「新增」或按確認鍵即可。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>重命名或刪除學科</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    將滑鼠懸停於學科名稱上，右側將會顯示編輯（鉛筆）與刪除（垃圾桶）圖示。點擊編輯圖示可重新命名；點擊刪除圖示可將科目移除。
                    <span style={{ color: 'var(--danger)', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      注意：刪除學科時可選擇保留底下錯題（轉為未分類）或至分類管理重新指派。
                    </span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>章節管理</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    展開學科後，點擊學科名稱最右側的 <strong>+</strong> 圖示，即可在該學科下新增一個子章節（例如：第二章 三角函數）。章節同樣支援點選右側的鉛筆圖示重新命名，或垃圾桶圖示刪除（會一併刪除該章節下的錯題）。
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'templates':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <Settings size={24} /> 自訂模板設計
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              不同科目的錯題記錄需求大不相同。利用自訂模板，您可以自主設計適合各學科的錄入格式。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>建立新模板</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    點擊左側側邊欄的「自訂模板管理」按鈕，進入模板編輯畫面後點擊「新增模板」。您可以為模板設定一個易懂的名稱（如「理科計算模板」或「文科單字模板」）。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>規劃題目與答案欄位</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    模板分為「題目欄位」與「答案欄位」兩大區塊。您可以點擊「新增欄位」來添加以下不同類型的元件：
                    <ul style={{ paddingLeft: '20px', marginTop: '6px', listStyleType: 'circle' }}>
                      <li><strong>文字輸入</strong>：適合輸入短文字（如：來源出處、題號）。</li>
                      <li><strong>長文字輸入</strong>：適合填寫大段敘述（如：題目原文、程式碼、多步驟解析）。</li>
                      <li><strong>上傳圖片</strong>：適合存放題目截圖或手繪公式照片。</li>
                      <li><strong>選擇題選項</strong>：可建立選單或標籤（如：錯因分析、關聯知識點），並可為各個選項標示不同顏色（如紅、黃、綠、藍）。</li>
                    </ul>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>調整順序與儲存</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    您可以利用每個欄位旁的 <strong>↑</strong> 與 <strong>↓</strong> 按鈕來調整其顯示順序，或點擊垃圾桶按鈕刪除該欄位。設計完成後，<strong>請務必點擊右上角的「儲存模板」按鈕</strong>以套用變更。
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'mistakes':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <PlusCircle size={24} /> 錯題新增與圖片上傳
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              當您規劃好學科章節與模板後，即可開始記錄錯題：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>新增錯題視窗</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    點選進入任何一個「章節」，點擊頁面右上角的「新增錯題」按鈕，系統會彈出一個錯題編輯視窗。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>選擇模板與基本資訊</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    輸入題目名稱，並在下拉選單中選擇要套用的模板。系統會隨即動態產生您在該模板中設計的全部欄位。同時，請選擇此錯題的難度等級：<strong>順、卡、不會、誤解</strong>。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>填寫內容與圖片上傳</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    依序填寫各欄位。對於圖片欄位，點擊「選擇圖片」或直接將圖檔拖入上傳區。
                    <span style={{ color: 'var(--success)', display: 'block', marginTop: '4px', fontWeight: 500 }}>
                      貼心功能：系統在前端會對上傳的圖片進行自動壓縮處理。這能大幅降低網路流量並加速頁面讀取速度，同時保持圖片的清晰度。
                    </span>
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>儲存與預覽</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    填寫完題目與解析內容後，點擊「儲存」即可完成登錄。在錯題清單中點選錯題，即可展開預覽完整的題目與解答。
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'filtering':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <Filter size={24} /> 題目篩選系統
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              隨著錯題累積增加，如何快速找到需要複習的特定題目變得至關重要。系統提供強大的多維度篩選系統：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>關鍵字搜尋</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    在錯題清單頂部的搜尋欄中鍵入任意字詞，系統將會即時比對錯題標題以及各個自訂文字欄位的內容，篩選出符合的項目。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>日期範圍篩選</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    點擊搜尋欄右側的「日期篩選」展開面板，您可以設定「開始日期」與「結束日期」，只顯示該時間區段內所新增的錯題。這非常適合用來進行「週複習」或「月考前複習」。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>難度核取方塊交叉篩選</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    搜尋區下方提供四個難度標籤核取方塊：<strong>順、卡、不會、誤解</strong>。您可以同時勾選多個難度。例如：同時勾選「不會」與「誤解」，系統便會為您篩選出這兩個難度級別的錯題，方便集中突破。
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'exporting':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <FileText size={24} /> 匯出
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              本系統支援將選定的錯題批量匯出，供您列印成紙本重新練習，或是另存於平板中進行數位複習。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>選取要匯出的錯題</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    在錯題卡片的左上角，有一個核取方塊。將滑鼠移至卡片上或點選，勾選您想要匯出的一道或多道題目。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>進入匯出預覽頁面</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    選取錯題後，畫面右下角會浮現一個帶有 <strong>匯出所選（數量）</strong> 的懸浮按鈕。點擊該按鈕即可進入專屬的匯出排版預覽頁面。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>隱藏解析與下載</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    在匯出頁面頂部，您可以點擊勾選 <strong>隱藏答案與解析</strong>。此時，畫面上所有的答案文字與解析圖片皆會隱藏，方便您產出一份乾淨的「空白練習卷」。點擊「列印 / 匯出」即可呼叫瀏覽器列印視窗，將目標選擇為「另存」儲存。
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'feedback':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <MessageSquare size={24} /> 意見與評價回饋
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              我們非常重視您的使用體驗，並持續致力於使系統變得更好。
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>開啟回饋視窗</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    在畫面最頂端的導覽列中，您可以找到一個標示著 <strong>意見回饋</strong> 的按鈕。點擊它即可彈出回饋填寫視窗。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>星級評分與留言</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    您可點選 1 至 5 顆星來對我們的應用程式進行評分，並在下方的文字方塊中留下您具體的優缺點意見、使用困擾或期望新增的功能。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>送出回饋</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    點擊「送出回饋」後，您的評價將會安全地儲存至伺服器中，並能由管理員在後台統一查閱，做為系統升級的寶貴參考。
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'admin':
        return (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }} className="title-gradient">
              <Shield size={24} /> 管理員系統
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              本系統內建管理員面板，以協助進行基本的系統維護與使用者管理：
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>單一管理員註冊機制</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    系統為了防範管理員帳號被濫用或惡意註冊，採取<strong>單一管理員鎖定原則</strong>。
                    當系統資料庫中還沒有任何管理員時，首個在註冊頁面勾選「註冊為管理員」的使用者會成功升級為管理員。此後，<strong>管理員通道將自動關閉</strong>，任何人若再次嘗試以管理員身分註冊將會被系統拒絕。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>進入管理員面板</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    若您登入的帳號具有管理員身份（具備管理員權限），頂部導覽列將會自動出現 <strong>管理員面板</strong> 按鈕。點擊後即可檢視後台管理介面。
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ color: 'var(--accent-primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>用戶與意見回饋管理</strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    管理員可以在面板中進行兩大維護工作：
                    <ul style={{ paddingLeft: '20px', marginTop: '6px', listStyleType: 'circle' }}>
                      <li><strong>用戶管理</strong>：列出所有已註冊的用戶與其註冊時間，管理員可針對違規帳號點擊「刪除」以強制清除帳號。</li>
                      <li><strong>回饋管理</strong>：集中檢視所有使用者提交的評分與建議留言，協助追蹤系統問題。</li>
                    </ul>
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      flex: 1,
      padding: '32px',
      overflowY: 'auto',
      height: 'calc(100vh - 64px)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%'
    }}>
      {/* Page Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ 
          color: 'var(--accent-primary)', 
          fontSize: '0.8rem', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '0.1em' 
        }}>
          說明中心
        </span>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }} className="title-gradient">使用說明與教學手冊</h1>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Left/Top Navigation Tabs */}
        <div style={{
          flex: '1 1 280px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          alignSelf: 'flex-start'
        }}>
          {sections.map(section => {
            const IconComponent = section.icon;
            const isActive = activeTab === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  textAlign: 'left',
                  borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--accent-gradient)' : 'var(--glass-bg)',
                  border: isActive ? 'none' : '1px solid var(--glass-border)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                  <IconComponent size={18} style={{ flexShrink: 0, color: isActive ? '#fff' : 'var(--accent-primary)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden' }}>
                    <span style={{ 
                      fontWeight: 600, 
                      fontSize: '0.92rem', 
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      width: '100%'
                    }}>
                      {section.title}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ 
                  flexShrink: 0, 
                  opacity: isActive ? 1 : 0.4,
                  transform: isActive ? 'translateX(2px)' : 'none',
                  transition: 'transform 0.2s'
                }} />
              </button>
            );
          })}
        </div>

        {/* Right Content Area */}
        <div className="glass" style={{
          flex: '9 9 500px',
          padding: '32px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-xl)',
          minHeight: '450px'
        }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
