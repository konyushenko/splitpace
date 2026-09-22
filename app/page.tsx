'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Download, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Split = { id: number; km: string; pace: string };

const initialSplits: Split[] = [
  { id: 1, km: '1', pace: '04:38' },
  { id: 2, km: '5', pace: '04:31' },
  { id: 3, km: '10', pace: '04:44' },
  { id: 4, km: '15', pace: '05:06' },
  { id: 5, km: '20', pace: '04:49' },
  { id: 6, km: '21.1', pace: '04:47' },
];

function paceToSeconds(value: string) {
  const [minutes, seconds] = value.split(':').map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return 0;
  return minutes * 60 + Math.min(59, seconds);
}

function formatPace(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function durationToSeconds(value: string) {
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function formatElapsed(seconds: number) {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export default function Home() {
  const [runnerName, setRunnerName] = useState('Алексей Воронов');
  const [draftName, setDraftName] = useState(runnerName);
  const [editingName, setEditingName] = useState(false);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [manualTotal, setManualTotal] = useState<string | null>(null);
  const [draftTotal, setDraftTotal] = useState('');
  const [editingTotal, setEditingTotal] = useState(false);

  const parsed = useMemo(() => splits.map((split) => ({
    ...split,
    distance: Number(split.km.replace(',', '.')),
    paceSeconds: paceToSeconds(split.pace),
  })).filter((split) => split.distance > 0 && split.paceSeconds > 0).sort((a, b) => a.distance - b.distance), [splits]);

  const timedSplits = useMemo(() => {
    let previousDistance = 0;
    let cumulativeSeconds = 0;
    return parsed.map((split) => {
      const segmentDistance = Math.max(0, split.distance - previousDistance);
      const segmentSeconds = segmentDistance * split.paceSeconds;
      cumulativeSeconds += segmentSeconds;
      previousDistance = split.distance;
      return { ...split, segmentSeconds, cumulativeSeconds };
    });
  }, [parsed]);

  const summary = useMemo(() => {
    const distance = parsed.at(-1)?.distance ?? 0;
    const calculatedTotal = timedSplits.at(-1)?.cumulativeSeconds ?? 0;
    const totalSeconds = manualTotal ? durationToSeconds(manualTotal) || calculatedTotal : calculatedTotal;
    const average = distance ? totalSeconds / distance : 0;
    const fastest = parsed.length ? Math.min(...parsed.map((s) => s.paceSeconds)) : 0;
    return { distance, totalSeconds, average, fastest };
  }, [manualTotal, parsed, timedSplits]);

  const updateSplit = (id: number, key: 'km' | 'pace', value: string) => {
    setSplits((current) => current.map((split) => split.id === id ? { ...split, [key]: value } : split));
  };

  const addSplit = () => {
    const last = parsed.at(-1);
    setSplits((current) => [...current, {
      id: Date.now(),
      km: last ? String(Math.round((last.distance + 1) * 10) / 10) : '1',
      pace: last ? formatPace(last.paceSeconds) : '05:00',
    }]);
  };

  const moveSplit = (index: number, direction: -1 | 1) => {
    setSplits((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
      return reordered;
    });
  };

  const saveName = () => {
    if (draftName.trim()) setRunnerName(draftName.trim());
    setEditingName(false);
  };

  const saveTotal = () => {
    const seconds = durationToSeconds(draftTotal);
    if (seconds > 0) setManualTotal(formatDuration(seconds));
    setEditingTotal(false);
  };

  const exportSplits = () => {
    const rows = [['Бегун', runnerName], ['Километр', 'Темп мин/км'], ...parsed.map((split) => [String(split.distance), formatPace(split.paceSeconds)])];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${runnerName.toLowerCase().replaceAll(' ', '-')}-splits.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#f3f3ef] text-[#171813]">
      <header className="border-b border-black/10 bg-[#f3f3ef]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <span className="text-sm font-medium text-black/60">Результат забега</span>
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-full bg-[#ff5a36] text-[10px] font-black text-white">SP</span>
            SPLITPACE
          </div>
          <Button onClick={exportSplits} variant="outline" size="sm" className="rounded-full border-black/15 bg-transparent px-3">
            <Download /> <span className="hidden sm:inline">Экспорт</span>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-5 py-8 lg:px-10 lg:py-10">
        <section className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            {editingName ? (
              <div className="flex max-w-[560px] items-center gap-2">
                <Input autoFocus value={draftName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && saveName()} className="h-12 rounded-none border-0 border-b-2 border-[#171813] bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0 sm:text-5xl" aria-label="Имя бегуна" />
                <Button onClick={saveName} size="icon" className="size-11 rounded-full bg-[#171813]"><Check /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold tracking-[-0.045em] sm:text-6xl">{runnerName}</h1>
                <button onClick={() => { setDraftName(runnerName); setEditingName(true); }} className="grid size-10 shrink-0 place-items-center rounded-full border border-black/15 text-black/55 transition hover:border-black hover:bg-white hover:text-black" aria-label="Редактировать имя">
                  <Pencil className="size-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-black/55"><span className="size-2 rounded-full bg-[#68a176]" /> Данные обновляются сразу</div>
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="rounded-[22px] border border-black/10 bg-white p-5 sm:p-6" aria-labelledby="splits-heading">
            <div className="mb-5 flex items-start justify-between">
              <div><h2 id="splits-heading" className="text-xl font-bold tracking-tight">Сплиты</h2><p className="mt-1 text-sm text-black/45">Дистанция и темп на участке</p></div>
              <Button variant="ghost" size="icon-sm" onClick={() => { setSplits(initialSplits); setManualTotal(null); }} className="rounded-full text-black/45 hover:text-black" aria-label="Вернуть исходные значения"><RotateCcw /></Button>
            </div>
            <div className="mb-2 grid grid-cols-[1fr_1.1fr_58px] gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-black/35"><span>Километр</span><span>Темп /км</span><span /></div>
            <div className="space-y-2">
              {splits.map((split, index) => (
                <div key={split.id} className="group grid grid-cols-[1fr_1.1fr_58px] items-center gap-2 rounded-xl bg-[#f4f4f0] p-2 transition focus-within:bg-[#efefe9]">
                  <label className="flex items-center gap-1.5">
                    <span className="w-5 text-center text-xs font-semibold text-black/30">{index + 1}</span>
                    <Input inputMode="decimal" value={split.km} onChange={(event) => updateSplit(split.id, 'km', event.target.value)} className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Дистанция сплита ${index + 1} в километрах`} />
                  </label>
                  <Input value={split.pace} onChange={(event) => updateSplit(split.id, 'pace', event.target.value)} placeholder="05:00" className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Темп сплита ${index + 1}`} />
                  <div className="flex items-center justify-end gap-0.5">
                    <div className="flex flex-col">
                      <button disabled={index === 0} onClick={() => moveSplit(index, -1)} className="grid size-5 place-items-center rounded text-black/35 transition hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-20" aria-label={`Переместить сплит ${index + 1} выше`}><ChevronUp className="size-3.5" /></button>
                      <button disabled={index === splits.length - 1} onClick={() => moveSplit(index, 1)} className="grid size-5 place-items-center rounded text-black/35 transition hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-20" aria-label={`Переместить сплит ${index + 1} ниже`}><ChevronDown className="size-3.5" /></button>
                    </div>
                    <button onClick={() => setSplits((current) => current.filter((item) => item.id !== split.id))} className="grid size-8 place-items-center rounded-lg text-black/25 transition hover:bg-[#ffe5de] hover:text-[#c8371d]" aria-label={`Удалить сплит ${index + 1}`}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={addSplit} variant="outline" className="mt-4 h-10 w-full rounded-xl border-dashed border-black/20 bg-transparent text-black/65 hover:bg-[#f4f4f0]"><Plus /> Добавить сплит</Button>
          </section>

          <div className="min-w-0 space-y-5 xl:self-start">
            <section className="grid overflow-hidden rounded-[22px] border border-black/10 bg-[#171813] text-white sm:grid-cols-3" aria-label="Итоговые показатели">
              <TotalMetric
                value={formatDuration(summary.totalSeconds)}
                adjusted={Boolean(manualTotal)}
                editing={editingTotal}
                draft={draftTotal}
                onDraftChange={setDraftTotal}
                onEdit={() => { setDraftTotal(formatDuration(summary.totalSeconds)); setEditingTotal(true); }}
                onSave={saveTotal}
                onReset={() => { setManualTotal(null); setEditingTotal(false); }}
              />
              <Metric label="Средний темп" value={`${formatPace(summary.average)} /км`} detail={`лучший ${formatPace(summary.fastest)} /км`} accent />
              <Metric label="Дистанция" value={`${summary.distance.toLocaleString('ru-RU')} км`} detail={`${parsed.length} контрольных точек`} />
            </section>

            <section className="overflow-hidden rounded-[22px] border border-black/10 bg-white" aria-labelledby="timing-heading">
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-5 sm:px-7">
                <div>
                  <h2 id="timing-heading" className="text-xl font-bold tracking-tight sm:text-2xl">Временные сплиты</h2>
                  <p className="mt-1 text-sm text-black/45">Накопленное время и результат каждого участка</p>
                </div>
                <span className="rounded-full bg-[#f3f3ef] px-3 py-1.5 text-xs font-semibold text-black/50">{timedSplits.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[660px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-black/10 text-xs font-semibold text-black/45">
                      <th className="px-5 py-3.5 sm:px-7">Промежуточная точка</th>
                      <th className="px-5 py-3.5">Время на точке</th>
                      <th className="px-5 py-3.5">Время за участок</th>
                      <th className="px-5 py-3.5 sm:pr-7">Темп на участке</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timedSplits.map((split) => (
                      <tr key={`timing-${split.id}`} className="border-b border-black/[0.07] last:border-b-0">
                        <td className="px-5 py-4 font-semibold sm:px-7">{split.distance.toLocaleString('ru-RU')} км</td>
                        <td className="px-5 py-4 tabular-nums text-black/65">{formatElapsed(split.cumulativeSeconds)}</td>
                        <td className="px-5 py-4 tabular-nums text-black/65">{formatElapsed(split.segmentSeconds)}</td>
                        <td className="px-5 py-4 font-semibold tabular-nums sm:pr-7">{formatPace(split.paceSeconds)} /км</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-[22px] border border-black/10 bg-white p-5 sm:p-7" aria-labelledby="chart-heading">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h2 id="chart-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Темп по дистанции</h2>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-black/55">
                  <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#ff5a36]" /> Темп</span>
                  <span className="flex items-center gap-2"><i className="h-px w-5 border-t border-dashed border-black/50" /> Средний темп</span>
                </div>
              </div>
              <PaceChart data={parsed} average={summary.average} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={`min-w-0 p-5 sm:p-7 ${accent ? 'bg-[#ff5a36]' : 'border-white/10 sm:border-r last:border-r-0'}`}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p><p className="mt-3 truncate text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{value}</p><p className="mt-2 text-xs text-white/50">{detail}</p></div>;
}

function TotalMetric({ value, adjusted, editing, draft, onDraftChange, onEdit, onSave, onReset }: { value: string; adjusted: boolean; editing: boolean; draft: string; onDraftChange: (value: string) => void; onEdit: () => void; onSave: () => void; onReset: () => void }) {
  return (
    <div className="min-w-0 border-white/10 p-5 sm:border-r sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Общее время</p>
      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <Input autoFocus value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSave()} className="h-10 min-w-0 rounded-lg border-white/20 bg-white/10 px-2 text-xl font-semibold text-white shadow-none focus-visible:border-white/50 focus-visible:ring-white/20" aria-label="Общее время в формате часы минуты секунды" />
          <button onClick={onSave} className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#171813]" aria-label="Сохранить общее время"><Check className="size-4" /></button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <p className="truncate text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{value}</p>
          <button onClick={onEdit} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/20 text-white/60 transition hover:bg-white/10 hover:text-white" aria-label="Редактировать общее время"><Pencil className="size-3.5" /></button>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
        <span>{adjusted ? 'скорректировано вручную' : 'расчёт по сплитам'}</span>
        {adjusted && <button onClick={onReset} className="underline decoration-white/30 underline-offset-2 transition hover:text-white" aria-label="Вернуть расчётное общее время">Сбросить</button>}
      </div>
    </div>
  );
}

function PaceChart({ data, average }: { data: Array<Split & { distance: number; paceSeconds: number }>; average: number }) {
  const width = 820;
  const height = 310;
  const padding = { top: 22, right: 22, bottom: 58, left: 72 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const chartData = data.length ? [{ ...data[0], id: -1, distance: 0 }, ...data] : [];
  const paces = chartData.map((item) => item.paceSeconds);
  const minPace = paces.length ? Math.floor((Math.min(...paces, average) - 15) / 10) * 10 : 240;
  const maxPace = paces.length ? Math.ceil((Math.max(...paces, average) + 15) / 10) * 10 : 360;
  const maxDistance = data.length ? Math.max(...data.map((item) => item.distance)) : 1;
  const x = (distance: number) => padding.left + (distance / maxDistance) * chartWidth;
  const y = (pace: number) => padding.top + ((pace - minPace) / Math.max(1, maxPace - minPace)) * chartHeight;
  const points = chartData.map((item) => `${x(item.distance)},${y(item.paceSeconds)}`).join(' ');
  const ticks = Array.from({ length: 5 }, (_, index) => minPace + ((maxPace - minPace) / 4) * index);
  const areaPoints = chartData.length ? `${x(0)},${padding.top + chartHeight} ${points} ${x(maxDistance)},${padding.top + chartHeight}` : '';

  return (
    <div className="mt-7 h-[310px] overflow-hidden sm:h-[340px]" role="img" aria-label="График изменения темпа по дистанции">
      {data.length < 1 ? <div className="grid h-full place-items-center rounded-2xl border border-dashed border-black/15 text-center text-sm text-black/40">Добавьте корректный сплит,<br />чтобы увидеть график.</div> : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
          <defs><linearGradient id="paceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff5a36" stopOpacity="0.18" /><stop offset="100%" stopColor="#ff5a36" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((tick) => <g key={tick}><line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="#171813" strokeOpacity="0.09" /><text x={padding.left - 12} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#171813" fillOpacity="0.45">{formatPace(tick)}</text></g>)}
          {chartData.map((item) => <g key={`axis-${item.id}`}><line x1={x(item.distance)} x2={x(item.distance)} y1={padding.top} y2={padding.top + chartHeight} stroke="#171813" strokeOpacity="0.045" /><text x={x(item.distance)} y={height - 30} textAnchor="middle" fontSize="11" fill="#171813" fillOpacity="0.5">{item.distance} км</text></g>)}
          <text x={padding.left + chartWidth / 2} y={height - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#171813" fillOpacity="0.48">Дистанция, км</text>
          <text x="15" y={padding.top + chartHeight / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#171813" fillOpacity="0.48" transform={`rotate(-90 15 ${padding.top + chartHeight / 2})`}>Темп, мин/км</text>
          <polygon points={areaPoints} fill="url(#paceArea)" />
          <line x1={padding.left} x2={width - padding.right} y1={y(average)} y2={y(average)} stroke="#171813" strokeOpacity="0.5" strokeDasharray="6 6" />
          <polyline points={points} fill="none" stroke="#ff5a36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {chartData.map((item) => <g key={`point-${item.id}`}><circle cx={x(item.distance)} cy={y(item.paceSeconds)} r="7" fill="white" stroke="#ff5a36" strokeWidth="3" vectorEffect="non-scaling-stroke" /><title>{`${item.distance} км — ${formatPace(item.paceSeconds)} /км`}</title></g>)}
        </svg>
      )}
    </div>
  );
}
