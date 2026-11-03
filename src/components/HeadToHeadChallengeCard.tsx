'use client';

import React, { useMemo, useState } from 'react';
import {
  buildChallengeShareLinks,
  getChallengeHeadline,
  getChallengeSubtitle,
  saveChallengerName,
  type DuelOutcomeSummary,
  type HeadToHeadChallengePayload,
} from '@/lib/headToHeadChallenge';

export function HeadToHeadIncomingBanner({
  challenge,
  onAccept,
  onDismiss,
  acceptButtonLabel,
}: {
  challenge: HeadToHeadChallengePayload;
  onAccept: () => void;
  onDismiss: () => void;
  acceptButtonLabel?: string;
}) {
  const headline = getChallengeHeadline(challenge);
  const subtitle = getChallengeSubtitle(challenge);

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/15 via-slate-900/95 to-rose-500/15 p-5 sm:p-6 shadow-2xl shadow-amber-500/10 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-400 text-slate-950 shadow">
              <span>⚔️</span>
              <span>Head-to-Head Challenge</span>
            </span>
            <span className="text-xs font-bold text-amber-200">
              From <strong className="text-white">{challenge.challenger}</strong>
            </span>
          </div>

          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            &ldquo;{headline}&rdquo;
          </h2>
          <p className="text-xs text-slate-300">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onAccept}
            className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 transition transform hover:-translate-y-0.5 cursor-pointer"
          >
            {acceptButtonLabel || '⚔️ Accept Challenge & Start Now →'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-3.5 py-3.5 rounded-2xl bg-slate-950/80 hover:bg-slate-800 border border-white/[0.1] text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
            title="Dismiss incoming challenge"
          >
            ✕ Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function HeadToHeadLiveTargetBar({
  challengerName,
  currentValue,
  targetValue,
  unitLabel = 'pts',
  extraTargetNote,
}: {
  challengerName: string;
  currentValue: number;
  targetValue: number;
  unitLabel?: string;
  extraTargetNote?: string;
}) {
  const safeTarget = Math.max(1, targetValue);
  const progressPct = Math.min(100, Math.round((currentValue / safeTarget) * 100));
  const hasBeaten = currentValue > targetValue;
  const isTied = currentValue === targetValue && targetValue > 0;

  return (
    <div
      className={`rounded-2xl p-3.5 border transition-all shadow-lg ${
        hasBeaten
          ? 'bg-emerald-950/50 border-emerald-400/50'
          : isTied
          ? 'bg-amber-950/40 border-amber-400/50'
          : 'bg-slate-900/95 border-amber-400/30'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase tracking-wider border border-amber-400/30">
            ⚔️ H2H Target
          </span>
          <span className="font-bold text-slate-200">
            Beat <strong className="text-white">{challengerName}</strong>:{' '}
            <strong className="text-amber-300">
              {targetValue} {unitLabel}
            </strong>
            {extraTargetNote ? <span className="text-slate-400"> ({extraTargetNote})</span> : null}
          </span>
        </div>

        <span
          className={`font-black text-xs ${
            hasBeaten
              ? 'text-emerald-400'
              : isTied
              ? 'text-amber-300'
              : 'text-slate-300'
          }`}
        >
          {hasBeaten
            ? `🔥 Ahead by +${currentValue - targetValue} ${unitLabel}!`
            : isTied
            ? '⚡ Tied! +1 to take the lead!'
            : `You: ${currentValue} / ${targetValue} ${unitLabel}`}
        </span>
      </div>

      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/[0.08]">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            hasBeaten
              ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
              : 'bg-gradient-to-r from-amber-400 to-rose-500'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

export function HeadToHeadVerdictBanner({
  outcome,
  onRematchSameSeed,
}: {
  outcome: DuelOutcomeSummary;
  onRematchSameSeed?: () => void;
}) {
  const styleCls =
    outcome.verdict === 'won'
      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
      : outcome.verdict === 'tied'
      ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
      : 'bg-rose-500/15 border-rose-400/45 text-rose-200';

  const badgeIcon =
    outcome.verdict === 'won' ? '🏆' : outcome.verdict === 'tied' ? '🤝' : '⚔️';

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${styleCls}`}>
      <div className="flex items-start sm:items-center gap-3">
        <span className="text-3xl shrink-0">{badgeIcon}</span>
        <div className="text-left">
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">
            Head-to-Head Duel Result
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">{outcome.headline}</h3>
          <p className="text-xs text-slate-200 mt-0.5">{outcome.detail}</p>
        </div>
      </div>

      {onRematchSameSeed && outcome.verdict !== 'won' && (
        <button
          type="button"
          onClick={onRematchSameSeed}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black text-xs uppercase tracking-wider border border-white/20 shrink-0 transition cursor-pointer"
        >
          🔄 Rematch Same Board
        </button>
      )}
    </div>
  );
}

export function HeadToHeadSharePanel({
  payload,
  onChallengerNameChange,
  conqueredChallenge,
}: {
  payload: HeadToHeadChallengePayload;
  onChallengerNameChange?: (nextName: string) => void;
  conqueredChallenge?: DuelOutcomeSummary | null;
}) {
  const [nameInput, setNameInput] = useState<string>(payload.challenger);
  const [editingName, setEditingName] = useState<boolean>(false);
  const [copiedState, setCopiedState] = useState<'idle' | 'link' | 'msg'>('idle');

  const activeName = (editingName ? nameInput : payload.challenger).trim() || 'Banking Aspirant';

  const effectivePayload = useMemo<HeadToHeadChallengePayload>(
    () => ({
      ...payload,
      challenger: activeName,
    }),
    [activeName, payload]
  );

  const shareData = useMemo(
    () =>
      buildChallengeShareLinks(effectivePayload, {
        conqueredChallenge,
      }),
    [conqueredChallenge, effectivePayload]
  );

  const commitName = () => {
    const clean = nameInput.trim() || 'Banking Aspirant';
    saveChallengerName(clean);
    onChallengerNameChange?.(clean);
    setEditingName(false);
  };

  const handleCopyChallengeMessage = async () => {
    try {
      await navigator.clipboard.writeText(shareData.fullShareText);
      setCopiedState('msg');
      window.setTimeout(() => setCopiedState('idle'), 2600);
    } catch {}
  };

  const handleCopyLinkOnly = async () => {
    try {
      await navigator.clipboard.writeText(shareData.challengeUrl);
      setCopiedState('link');
      window.setTimeout(() => setCopiedState('idle'), 2600);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: shareData.headline,
          text: shareData.fullShareText,
        });
      } catch {}
    } else {
      await handleCopyChallengeMessage();
    }
  };

  return (
    <div className="rounded-3xl border border-amber-400/35 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/35 p-5 sm:p-6 space-y-4 text-left shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-full">
            <span>⚔️</span>
            <span>Challenge Study Groups (1v1 Link)</span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-white">
            &ldquo;{shareData.headline}&rdquo;
          </h3>
          <p className="text-[11px] text-slate-400">
            Anyone opening your link gets the <strong className="text-slate-200">exact same challenge setup</strong> to try beating your score!
          </p>
        </div>

        {/* Challenger Name Pill */}
        <div className="shrink-0">
          {editingName ? (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-amber-400/50 rounded-xl p-1">
              <input
                type="text"
                maxLength={28}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitName();
                }}
                placeholder="Your name"
                className="w-32 bg-transparent px-2.5 py-1 text-xs font-bold text-white outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={commitName}
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameInput(payload.challenger);
                setEditingName(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/[0.1] text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Edit name shown on your challenge card"
            >
              <span className="text-slate-400">As:</span>
              <strong className="text-amber-300">{activeName}</strong>
              <span className="text-[10px] text-slate-400">✏️</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Share Buttons: Telegram, WhatsApp, Copy Challenge */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <a
          href={shareData.telegramShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 rounded-2xl bg-[#229ED9] hover:bg-[#1d8ec4] text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#229ED9]/20 transition transform hover:-translate-y-0.5"
        >
          <span>✈️</span>
          <span>Share on Telegram</span>
        </a>

        <a
          href={shareData.whatsappShareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-3 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#25D366]/20 transition transform hover:-translate-y-0.5"
        >
          <span>💬</span>
          <span>Share on WhatsApp</span>
        </a>

        <button
          type="button"
          onClick={() => void handleCopyChallengeMessage()}
          className="px-4 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
        >
          <span>{copiedState === 'msg' ? '✓' : '📋'}</span>
          <span>{copiedState === 'msg' ? 'Challenge Copied!' : 'Copy Challenge'}</span>
        </button>

        <button
          type="button"
          onClick={() => void handleCopyLinkOnly()}
          onDoubleClick={() => void handleNativeShare()}
          className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/[0.1] text-slate-100 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <span>{copiedState === 'link' ? '✓' : '🔗'}</span>
          <span>{copiedState === 'link' ? 'Link Copied!' : 'Copy Link Only'}</span>
        </button>
      </div>
    </div>
  );
}

