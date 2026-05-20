import { useState, useEffect } from 'react';
import { DailyFocusItem } from '../types';

const domainBorderColor: Record<string, string> = {
  rsm:      '#d4a017',
  akpsi:    '#06b6d4',
  school:   '#06b6d4',
  finance:  '#16a34a',
  network:  '#06b6d4',
  skills:   '#9333ea',
  personal: '#6b6580',
};

const domainTextClass: Record<string, string> = {
  rsm:      'text-gold',
  akpsi:    'text-cyan-400',
  school:   'text-cyan-400',
  finance:  'text-success',
  network:  'text-cyan-400',
  skills:   'text-accent',
  personal: 'text-text-muted',
};

interface Props {
  focus: DailyFocusItem[];
  onComplete: (taskId: string) => void;
}

export default function TodaysFocus({ focus, onComplete }: Props) {
  const [localCompleted, setLocalCompleted] = useState<Map<string, boolean>>(new Map());
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Active Mini-Grill states
  const [activeGrillTaskId, setActiveGrillTaskId] = useState<string | null>(null);
  const [grillStep, setGrillStep] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [isLoadingGrill, setIsLoadingGrill] = useState(false);
  const [copyFeedbackTaskId, setCopyFeedbackTaskId] = useState<string | null>(null);

  // Clear optimistic overrides when fresh DB data arrives
  useEffect(() => {
    setLocalCompleted(new Map());
  }, [focus]);

  const doneCount  = focus.filter(f => f.completed === 1 || f.status === 'done').length;
  const totalCount = focus.length;
  const allDone    = totalCount > 0 && doneCount === totalCount;

  const handleComplete = (taskId: string, currentDone: boolean) => {
    // Optimistic toggle — instant visual feedback before DB round-trip
    setLocalCompleted(prev => {
      const next = new Map(prev);
      next.set(taskId, !currentDone);
      return next;
    });
    setPulsing(prev => new Set([...prev, taskId]));
    onComplete(taskId);
    setTimeout(() => {
      setPulsing(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }, 600);
  };

  const handleToggleExpand = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
    }
  };

  const handleStartGrill = async (taskId: string) => {
    setIsLoadingGrill(true);
    setActiveGrillTaskId(taskId);
    try {
      const question = await window.pathkeeper.ai.startPreworkGrill(taskId);
      if (question === '__NO_GEMINI_API_KEY__') {
        alert('Google Gemini API Key is required for pre-work generation. Please enter it in the AI Panel settings.');
        handleCancelGrill(taskId);
      } else {
        setCurrentQuestion(question);
        setGrillStep(1);
        setAnswerText('');
      }
    } catch (err) {
      console.error('Failed to start grill:', err);
      alert('An error occurred while connecting to Google Gemini.');
      handleCancelGrill(taskId);
    } finally {
      setIsLoadingGrill(false);
    }
  };

  const handleSubmitAnswer = async (taskId: string) => {
    if (!answerText.trim() || isLoadingGrill) return;

    setIsLoadingGrill(true);
    try {
      const result = await window.pathkeeper.ai.submitGrillAnswer(taskId, answerText.trim());
      if (result === ('__NO_GEMINI_API_KEY__' as any)) {
        alert('Google Gemini API Key is required for pre-work generation.');
        handleCancelGrill(taskId);
      } else if (result.completed) {
        // Successful generation completed! Reset active grill states.
        // The db:changed listener in App.tsx refreshes focus automatically, exposing the prework.
        setActiveGrillTaskId(null);
        setGrillStep(null);
        setCurrentQuestion('');
        setAnswerText('');
      } else {
        // Set up the next question
        setCurrentQuestion(result.nextQuestion || 'Could you provide a little more detail?');
        setGrillStep(2);
        setAnswerText('');
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      alert('An error occurred while communicating with Gemini.');
    } finally {
      setIsLoadingGrill(false);
    }
  };

  const handleCancelGrill = async (taskId: string) => {
    try {
      await window.pathkeeper.ai.cancelGrill(taskId);
    } catch (e) {
      console.error(e);
    }
    setActiveGrillTaskId(null);
    setGrillStep(null);
    setCurrentQuestion('');
    setAnswerText('');
    setIsLoadingGrill(false);
  };

  const handleCopyDraft = (taskId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedbackTaskId(taskId);
    setTimeout(() => {
      setCopyFeedbackTaskId(null);
    }, 1500);
  };

  const handleCompleteTaskInsideAccordion = (taskId: string) => {
    handleComplete(taskId, false);
    setExpandedTaskId(null);
  };

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted" style={{ fontSize: '9px' }}>◆</span>
          <span className="panel-label">Today's Focus</span>
        </div>
        <span
          className="font-mono text-[12px] font-semibold tabular-nums transition-colors duration-500"
          style={{ color: allDone ? '#d4a017' : '#3d3650' }}
        >
          {doneCount}/{totalCount}
        </span>
      </div>

      <div className="space-y-2.5">
        {totalCount === 0 && (
          <p className="text-text-muted text-[12px]">
            No tasks set. Ask PathKeeper to set your focus.
          </p>
        )}

        {focus.map((item) => {
          const localOverride = localCompleted.get(item.task_id);
          const done       = localOverride !== undefined ? localOverride : (item.completed === 1 || item.status === 'done');
          const isPulsing  = pulsing.has(item.task_id);
          const border     = domainBorderColor[item.domain] ?? '#3d3650';
          const expanded   = expandedTaskId === item.task_id;

          return (
            <div
              key={item.id}
              className={`w-full flex flex-col rounded-lg transition-all duration-200 overflow-hidden ${
                done ? 'opacity-50' : 'bg-bg-panel/40 border border-border-card/20'
              }`}
              style={{
                background: 'rgba(15, 14, 24, 0.3)',
                borderColor: expanded && !done ? 'rgba(147, 51, 234, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                boxShadow: expanded && !done ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
              }}
            >
              {/* Row Header (Checkbox and Clickable Title) */}
              <div className="w-full flex items-start gap-2.5 text-left p-2.5 select-none">
                {/* Domain left border indicator */}
                <div
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: '2px',
                    minHeight: '18px',
                    alignSelf: 'stretch',
                    background: border,
                    opacity: done ? 0.5 : 1,
                  }}
                />

                {/* Checkbox Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleComplete(item.task_id, done);
                  }}
                  className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    isPulsing ? 'check-pulse' : ''
                  } ${
                    done
                      ? 'border-gold/50 bg-gold/10'
                      : 'border-text-muted hover:border-accent/50 cursor-pointer'
                  }`}
                >
                  {done && (
                    <svg className="w-2.5 h-2.5 text-gold" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 5l2.5 2.5L8 3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Task Title & Domain (Click to toggle accordion) */}
                <div
                  onClick={() => !done && handleToggleExpand(item.task_id)}
                  className={`flex-1 min-w-0 ${done ? 'cursor-default' : 'cursor-pointer hover:opacity-90'}`}
                >
                  <p
                    className="text-[13px] leading-snug font-medium transition-all duration-300"
                    style={
                      done
                        ? { textDecoration: 'line-through', color: '#d4a017', opacity: 0.55, textDecorationColor: 'rgba(212,160,23,0.4)' }
                        : { color: '#e8e4f0' }
                    }
                  >
                    {item.title}
                  </p>
                  {item.domain && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${domainTextClass[item.domain] ?? 'text-text-muted'}`}>
                        {item.domain}
                      </span>
                      {item.description && (
                        <span className="text-[10px] text-text-muted truncate max-w-[180px]">
                          • {item.description}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Pre-work / Accordion Toggle Indicators */}
                {!done && (
                  <div
                    onClick={() => handleToggleExpand(item.task_id)}
                    className="flex items-center gap-2 cursor-pointer mt-0.5 flex-shrink-0"
                  >
                    {item.ai_prep_content ? (
                      <span
                        className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20"
                        style={{ color: '#c084fc' }}
                      >
                        PRE-WORK READY
                      </span>
                    ) : (
                      activeGrillTaskId === item.task_id && (
                        <span className="text-[9px] text-purple-400 animate-pulse font-mono font-bold tracking-wider">
                          GRILLING
                        </span>
                      )
                    )}
                    <span className="text-[10px] text-text-muted transition-transform duration-200" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </div>
                )}
              </div>

              {/* Accordion Expansion Panel */}
              {expanded && !done && (
                <div
                  className="px-3.5 pb-3.5 pt-1.5 border-t border-border-card/10 animate-fade-in"
                  style={{ background: 'rgba(10, 9, 15, 0.25)' }}
                >
                  {/* Case 1: Active Grill Running */}
                  {activeGrillTaskId === item.task_id ? (
                    <div className="space-y-3 bg-[#0f0e18]/85 p-3 rounded-lg border border-purple-500/10">
                      {/* Step Indicator */}
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold tracking-wider uppercase">
                            AI Mini-Grill — Step {grillStep} of 2
                          </span>
                          <span className="text-[8px] font-medium font-sans tracking-wide text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full select-none">
                            Gemini 3.5 Flash
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${grillStep && grillStep >= 1 ? 'bg-purple-500' : 'bg-white/10'}`} />
                          <div className={`w-1.5 h-1.5 rounded-full ${grillStep && grillStep >= 2 ? 'bg-purple-500' : 'bg-white/10'}`} />
                        </div>
                      </div>

                      {/* Question Text */}
                      {isLoadingGrill && !currentQuestion ? (
                        <div className="text-[12px] text-text-muted font-mono py-1 animate-pulse">
                          Connecting to Gemini 3.5 Flash...
                        </div>
                      ) : (
                        <p className="text-[13px] text-text-primary leading-relaxed font-semibold">
                          {currentQuestion}
                        </p>
                      )}

                      {/* Answer Input and Buttons */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={answerText}
                          onChange={e => setAnswerText(e.target.value)}
                          placeholder={isLoadingGrill ? "Communicating..." : "Type your response..."}
                          disabled={isLoadingGrill}
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && handleSubmitAnswer(item.task_id)}
                          className="flex-1 outline-none text-[12.5px] text-text-primary placeholder-text-muted rounded-md px-3 py-2 transition-all duration-200"
                          style={{
                            background: '#0a0a0f',
                            border: '1px solid rgba(147,51,234,0.3)',
                          }}
                        />
                        <button
                          onClick={() => handleSubmitAnswer(item.task_id)}
                          disabled={isLoadingGrill || !answerText.trim()}
                          className="px-4 py-2 rounded-md text-[12px] font-semibold text-white transition-all duration-200 disabled:opacity-40 hover:opacity-90 active:scale-[0.98] select-none cursor-pointer"
                          style={{ background: '#9333ea' }}
                        >
                          {isLoadingGrill ? '...' : 'Submit'}
                        </button>
                        <button
                          onClick={() => handleCancelGrill(item.task_id)}
                          disabled={isLoadingGrill}
                          className="px-3 py-2 rounded-md text-[12px] font-semibold text-text-muted border border-border-card/25 hover:text-text-secondary transition-colors duration-200 select-none cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : item.ai_prep_content ? (
                    /* Case 2: Prework Ready */
                    <div className="space-y-3 bg-[#0f0e18]/45 p-3 rounded-lg border border-purple-500/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-purple-400 uppercase">
                          PRE-WORK DRAFT READY
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyDraft(item.task_id, item.ai_prep_content || '')}
                            className="px-2.5 py-1 rounded text-[11px] font-bold text-accent-light border border-accent/20 hover:bg-accent/5 transition-all select-none cursor-pointer"
                          >
                            {copyFeedbackTaskId === item.task_id ? '✓ Copied!' : 'Copy Draft'}
                          </button>
                          <button
                            onClick={() => handleCompleteTaskInsideAccordion(item.task_id)}
                            className="px-2.5 py-1 rounded text-[11px] font-bold text-white bg-success hover:opacity-90 transition-all select-none cursor-pointer"
                          >
                            Complete Task
                          </button>
                        </div>
                      </div>

                      {/* Display Markdown beautifully in a styled block */}
                      <pre className="text-[12.5px] text-text-secondary leading-relaxed bg-[#050508] p-3 rounded border border-border-card/5 whitespace-pre-wrap font-sans overflow-x-auto select-text">
                        {item.ai_prep_content}
                      </pre>
                    </div>
                  ) : (
                    /* Case 3: Initial view (Not prepped, not grilling) */
                    <div className="flex items-center justify-between py-1 bg-[#0f0e18]/25 px-2 rounded-lg border border-white/5">
                      <span className="text-[11.5px] text-text-muted font-medium">
                        Need preparation or templates for this task?
                      </span>
                      <button
                        onClick={() => handleStartGrill(item.task_id)}
                        disabled={isLoadingGrill}
                        className="px-3.5 py-1.5 rounded-md text-[11.5px] font-bold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] select-none cursor-pointer"
                        style={{
                          background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                          boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                        }}
                      >
                        Generate Pre-work
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
