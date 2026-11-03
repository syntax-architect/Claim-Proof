import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  Eye,
  FileEdit,
  Languages,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import {
  getDisputeTemplate,
  renderDisputeTemplate,
  type DisputeTemplateCategory,
  type DisputeTemplateData,
  type DisputeTemplateLanguage
} from '../../config/disputeTemplates';
import { formatIST } from '../../lib/dateUtils';
import { t } from '../../lib/i18n';
import { Badge, Button, useToast } from '../ui';
import type { ClaimItem, FlagReason, RecordingMeta } from '../../types';

interface DisputeMessageStudioProps {
  claim: ClaimItem;
  dispatchRec?: RecordingMeta | null;
  returnRec?: RecordingMeta | null;
  initialText?: string;
  onTextChange?: (text: string) => void;
}

function mapFlagReasonToCategory(reason: FlagReason): DisputeTemplateCategory {
  switch (reason) {
    case 'Wrong/Swapped item':
      return 'wrong_item';
    case 'Damaged':
    case 'Used/Worn':
      return 'damaged';
    case 'Empty package':
    case 'Missing item':
      return 'empty';
    default:
      return 'general';
  }
}

function getDefaultWhatWasReceived(
  reason: FlagReason,
  lang: DisputeTemplateLanguage,
  notes?: string
): string {
  if (notes && notes.trim()) {
    return notes.trim();
  }
  if (lang === 'hi') {
    switch (reason) {
      case 'Wrong/Swapped item':
        return 'भिन्न / बदला हुआ सामान प्राप्त हुआ';
      case 'Damaged':
        return 'क्षतिग्रस्त / टूटा हुआ उत्पाद प्राप्त हुआ';
      case 'Used/Worn':
        return 'इस्तेमाल किया हुआ / पुराना उत्पाद प्राप्त हुआ';
      case 'Empty package':
        return 'खाली पार्सल (सामग्री गायब) प्राप्त हुआ';
      case 'Missing item':
        return 'सामग्री अधूरी / गायब प्राप्त हुई';
      default:
        return 'अनुचित स्थिति में सामान प्राप्त हुआ';
    }
  }

  switch (reason) {
    case 'Wrong/Swapped item':
      return 'Different / swapped item received';
    case 'Damaged':
      return 'Damaged / broken item received';
    case 'Used/Worn':
      return 'Used / worn item received';
    case 'Empty package':
      return 'Empty parcel with missing contents';
    case 'Missing item':
      return 'Partial shipment with missing items';
    default:
      return 'Discrepant return item received';
  }
}

function getDefaultWhatWasSent(
  sku: string,
  qty: number,
  size?: string,
  lang: DisputeTemplateLanguage = 'en'
): string {
  if (!sku || sku === 'UNKNOWN') return '';
  const sizeStr = size && size !== 'Free' ? `Size: ${size}, ` : '';
  if (lang === 'hi') {
    return `${sku} (${sizeStr}मात्रा: ${qty})`;
  }
  return `${sku} (${sizeStr}Qty: ${qty})`;
}

export function DisputeMessageStudio({
  claim,
  dispatchRec,
  returnRec: _returnRec,
  initialText,
  onTextChange
}: DisputeMessageStudioProps) {
  const toast = useToast();
  const initialCategory = useMemo(
    () => mapFlagReasonToCategory(claim.flagReason),
    [claim.flagReason]
  );

  const [language, setLanguage] = useState<DisputeTemplateLanguage>('en');
  const [category, setCategory] = useState<DisputeTemplateCategory>(initialCategory);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('preview');

  // Pre-fill data from claim and recordings
  const disputeData = useMemo<DisputeTemplateData>(() => {
    const rawOrderId = claim.orderId && claim.orderId !== 'UNKNOWN' ? claim.orderId : '';
    const rawAwb = claim.awb && claim.awb !== 'UNKNOWN' ? claim.awb : '';
    const rawSku = claim.sku && claim.sku !== 'UNKNOWN' ? claim.sku : '';
    const dispatchDate = dispatchRec?.startedAt ? formatIST(dispatchRec.startedAt) : '';
    const returnDate = claim.returnScanAt ? formatIST(claim.returnScanAt) : '';
    const whatWasSent = getDefaultWhatWasSent(rawSku, claim.qty || 1, dispatchRec?.size, language);
    const whatWasReceived = getDefaultWhatWasReceived(claim.flagReason, language, claim.notes);

    return {
      orderId: rawOrderId,
      awb: rawAwb,
      sku: rawSku,
      dispatchDate,
      returnDate,
      whatWasSent,
      whatWasReceived,
      notes: claim.notes || ''
    };
  }, [claim, dispatchRec, language]);

  // Current template definition
  const templateDef = useMemo(() => getDisputeTemplate(category, language), [category, language]);

  // Computed render result
  const renderResult = useMemo(
    () => renderDisputeTemplate(templateDef.template, disputeData, language),
    [templateDef, disputeData, language]
  );

  // Editable user text
  const [userText, setUserText] = useState<string>(initialText || renderResult.text);

  // When template, language, or data changes, update user text if user hasn't explicitly customized it,
  // or on language/template switch
  useEffect(() => {
    setUserText(renderResult.text);
    onTextChange?.(renderResult.text);
  }, [renderResult.text, onTextChange]);

  const handleTextChange = (newVal: string) => {
    setUserText(newVal);
    onTextChange?.(newVal);
  };

  const handleResetToTemplate = () => {
    setUserText(renderResult.text);
    onTextChange?.(renderResult.text);
    toast.info('Reset to template');
  };

  const handleCopy = () => {
    if (!navigator.clipboard) {
      toast.error(t('dispute.copyFailed'), t('dispute.copyFailedNextStep'));
      return;
    }
    void navigator.clipboard
      .writeText(userText)
      .then(() => toast.success(t('dispute.copied')))
      .catch(() => toast.error(t('dispute.copyFailed'), t('dispute.copyFailedNextStep')));
  };

  const hasMissing = renderResult.missingFields.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-line bg-ink-900/60 p-4">
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Badge tone="mono">{t('dispute.header')}</Badge>
          {hasMissing ? (
            <Badge tone="warn">
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t('dispute.missingFieldsAlert', {
                  count: renderResult.missingFields.length,
                  fields: renderResult.missingFields.join(', ')
                })}
              </span>
            </Badge>
          ) : (
            <Badge tone="proof">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('dispute.allFieldsFilled')}
              </span>
            </Badge>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-line bg-ink-950 p-0.5">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                language === 'en'
                  ? 'bg-proof-500/20 text-proof-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Languages className="h-3 w-3" />
              {t('dispute.languageEn')}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                language === 'hi'
                  ? 'bg-proof-500/20 text-proof-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Languages className="h-3 w-3" />
              {t('dispute.languageHi')}
            </button>
          </div>

          {/* Reset button */}
          <Button
            variant="ghost"
            size="xs"
            icon={RefreshCw}
            onClick={handleResetToTemplate}
            title={t('dispute.regenerate')}
          >
            {t('dispute.regenerate')}
          </Button>

          {/* Copy Button */}
          <Button
            variant="primary"
            size="xs"
            icon={ClipboardCopy}
            onClick={handleCopy}
            title={t('dispute.copy')}
          >
            {t('dispute.copy')}
          </Button>
        </div>
      </div>

      {/* Template Category Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-400">{t('dispute.templateLabel')}:</span>
        <button
          type="button"
          onClick={() => setCategory('general')}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            category === 'general'
              ? 'border-proof-500 bg-proof-500/10 font-semibold text-proof-300'
              : 'border-line bg-ink-950/80 text-slate-400 hover:text-white'
          }`}
        >
          {t('dispute.templateGeneral')}
        </button>
        <button
          type="button"
          onClick={() => setCategory('wrong_item')}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            category === 'wrong_item'
              ? 'border-proof-500 bg-proof-500/10 font-semibold text-proof-300'
              : 'border-line bg-ink-950/80 text-slate-400 hover:text-white'
          }`}
        >
          {t('dispute.templateWrongItem')}
        </button>
        <button
          type="button"
          onClick={() => setCategory('damaged')}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            category === 'damaged'
              ? 'border-proof-500 bg-proof-500/10 font-semibold text-proof-300'
              : 'border-line bg-ink-950/80 text-slate-400 hover:text-white'
          }`}
        >
          {t('dispute.templateDamaged')}
        </button>
        <button
          type="button"
          onClick={() => setCategory('empty')}
          className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
            category === 'empty'
              ? 'border-proof-500 bg-proof-500/10 font-semibold text-proof-300'
              : 'border-line bg-ink-950/80 text-slate-400 hover:text-white'
          }`}
        >
          {t('dispute.templateEmpty')}
        </button>
      </div>

      {/* Missing Fields Warning Banner */}
      {hasMissing && (
        <div
          data-testid="missing-fields-banner"
          className="flex items-start gap-2.5 rounded-lg border border-warn-500/40 bg-warn-500/10 p-3 text-xs text-warn-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-400" />
          <div className="space-y-1">
            <p className="font-semibold">{t('dispute.missingFieldsBanner')}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {renderResult.missingFields.map((field) => (
                <span
                  key={field}
                  className="rounded border border-warn-500/50 bg-warn-500/20 px-1.5 py-0.5 font-mono text-[11px] font-bold text-warn-300"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Switcher: Preview (with Highlights) vs Edit Text */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="tab-preview"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'preview'
                ? 'border border-proof-500/30 bg-proof-500/20 text-proof-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            {t('dispute.tabPreview')}
            {hasMissing && (
              <span className="rounded-full bg-warn-500/30 px-1.5 py-0.2 font-mono text-[10px] text-warn-300">
                {renderResult.missingFields.length}
              </span>
            )}
          </button>
          <button
            type="button"
            data-testid="tab-edit"
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'edit'
                ? 'border border-proof-500/30 bg-proof-500/20 text-proof-300'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileEdit className="h-3.5 w-3.5" />
            {t('dispute.tabEdit')}
          </button>
        </div>

        {/* Live Character Counter */}
        <div className="flex items-center gap-3">
          <span data-testid="char-counter" className="font-mono text-xs font-medium text-slate-400">
            {t('dispute.charCount', { count: userText.length })}
          </span>
        </div>
      </div>

      {/* Main Content Area: Preview Mode or Edit Mode */}
      {activeTab === 'preview' ? (
        <div
          data-testid="dispute-preview"
          className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-ink-950/80 p-4 font-mono text-xs leading-relaxed text-slate-200"
        >
          {renderResult.tokens.map((token, idx) => {
            if (token.type === 'text') {
              return <span key={idx}>{token.value}</span>;
            }
            if (token.isMissing) {
              return (
                <mark
                  key={idx}
                  data-testid="missing-field"
                  data-field={token.key}
                  className="rounded border border-amber-500/50 bg-amber-500/20 px-1.5 py-0.5 font-bold text-amber-300"
                  title={`Missing field: ${token.label}`}
                >
                  {token.value}
                </mark>
              );
            }
            return (
              <span
                key={idx}
                data-testid="filled-field"
                data-field={token.key}
                className="font-semibold text-proof-300"
              >
                {token.value}
              </span>
            );
          })}
        </div>
      ) : (
        <div>
          <textarea
            data-testid="dispute-textarea"
            value={userText}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={12}
            className="w-full rounded-xl border border-line bg-ink-950/90 p-4 font-mono text-xs leading-relaxed text-slate-200 focus:border-proof-500/50 focus:outline-none"
            placeholder="Edit your dispute message here..."
          />
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-proof-400" />
          <span>{t('dispute.disclaimer')}</span>
        </div>
      </div>
    </div>
  );
}
