'use client';

import { useMemo, useState } from 'react';
import { Check, Download, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
    const totalSeconds = timedSplits.at(-1)?.cumulativeSeconds ?? 0;
    const average = distance ? totalSeconds / distance : 0;
    const fastest = parsed.length ? Math.min(...parsed.map((s) => s.paceSeconds)) : 0;
    return { distance, totalSeconds, average, fastest };
  }, [parsed, timedSplits]);

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

  const saveName = () => {
    if (draftName.trim()) setRunnerName(draftName.trim());
    setEditingName(false);
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
              <Button variant="ghost" size="icon-sm" onClick={() => setSplits(initialSplits)} className="rounded-full text-black/45 hover:text-black" aria-label="Вернуть исходные значения"><RotateCcw /></Button>
            </div>
            <div className="mb-2 grid grid-cols-[1fr_1.1fr_34px] gap-3 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-black/35"><span>Километр</span><span>Темп /км</span><span /></div>
            <div className="space-y-2">
              {splits.map((split, index) => (
                <div key={split.id} className="group grid grid-cols-[1fr_1.1fr_34px] items-center gap-3 rounded-xl bg-[#f4f4f0] p-2 transition focus-within:bg-[#efefe9]">
                  <label className="flex items-center gap-1.5">
                    <span className="w-5 text-center text-xs font-semibold text-black/30">{index + 1}</span>
                    <Input inputMode="decimal" value={split.km} onChange={(event) => updateSplit(split.id, 'km', event.target.value)} className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Дистанция сплита ${index + 1} в километрах`} />
                  </label>
                  <Input value={split.pace} onChange={(event) => updateSplit(split.id, 'pace', event.target.value)} placeholder="05:00" className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Темп сплита ${index + 1}`} />
                  <button onClick={() => setSplits((current) => current.filter((item) => item.id !== split.id))} className="grid size-8 place-items-center rounded-lg text-black/25 transition hover:bg-[#ffe5de] hover:text-[#c8371d]" aria-label={`Удалить сплит ${index + 1}`}><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>
            <Button onClick={addSplit} variant="outline" className="mt-4 h-10 w-full rounded-xl border-dashed border-black/20 bg-transparent text-black/65 hover:bg-[#f4f4f0]"><Plus /> Добавить сплит</Button>
          </section>

          <div className="min-w-0 space-y-5 xl:self-start">
            <section className="grid overflow-hidden rounded-[22px] border border-black/10 bg-[#171813] text-white sm:grid-cols-3" aria-label="Итоговые показатели">
              <Metric label="Общее время" value={formatDuration(summary.totalSeconds)} detail="расчёт по сплитам" />
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

function PaceChart({ data, average }: { data: Array<Split & { distance: number; paceSeconds: number }>; average: number }) {
  const width = 820;
  const height = 310;
  const padding = { top: 28, right: 22, bottom: 40, left: 58 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const paces = data.map((item) => item.paceSeconds);
  const minPace = paces.length ? Math.floor((Math.min(...paces, average) - 15) / 10) * 10 : 240;
  const maxPace = paces.length ? Math.ceil((Math.max(...paces, average) + 15) / 10) * 10 : 360;
  const maxDistance = data.at(-1)?.distance || 1;
  const x = (distance: number) => padding.left + (distance / maxDistance) * chartWidth;
  const y = (pace: number) => padding.top + ((pace - minPace) / Math.max(1, maxPace - minPace)) * chartHeight;
  const points = data.map((item) => `${x(item.distance)},${y(item.paceSeconds)}`).join(' ');
  const ticks = Array.from({ length: 5 }, (_, index) => minPace + ((maxPace - minPace) / 4) * index);
  const areaPoints = data.length ? `${x(data[0].distance)},${padding.top + chartHeight} ${points} ${x(data.at(-1)!.distance)},${padding.top + chartHeight}` : '';

  return (
    <div className="mt-7 h-[310px] overflow-hidden sm:h-[340px]" role="img" aria-label="График изменения темпа по дистанции">
      {data.length < 2 ? <div className="grid h-full place-items-center rounded-2xl border border-dashed border-black/15 text-center text-sm text-black/40">Добавьте минимум два корректных сплита,<br />чтобы увидеть график.</div> : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
          <defs><linearGradient id="paceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff5a36" stopOpacity="0.18" /><stop offset="100%" stopColor="#ff5a36" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((tick) => <g key={tick}><line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="#171813" strokeOpacity="0.09" /><text x={padding.left - 12} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#171813" fillOpacity="0.45">{formatPace(tick)}</text></g>)}
          {data.map((item) => <g key={item.id}><line x1={x(item.distance)} x2={x(item.distance)} y1={padding.top} y2={padding.top + chartHeight} stroke="#171813" strokeOpacity="0.045" /><text x={x(item.distance)} y={height - 10} textAnchor="middle" fontSize="11" fill="#171813" fillOpacity="0.5">{item.distance} км</text></g>)}
          <polygon points={areaPoints} fill="url(#paceArea)" />
          <line x1={padding.left} x2={width - padding.right} y1={y(average)} y2={y(average)} stroke="#171813" strokeOpacity="0.5" strokeDasharray="6 6" />
          <text x={width - padding.right} y={y(average) - 9} textAnchor="end" fontSize="11" fontWeight="600" fill="#171813" fillOpacity="0.62">СР. {formatPace(average)}</text>
          <polyline points={points} fill="none" stroke="#ff5a36" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {data.map((item) => <g key={`point-${item.id}`}><circle cx={x(item.distance)} cy={y(item.paceSeconds)} r="7" fill="white" stroke="#ff5a36" strokeWidth="3" vectorEffect="non-scaling-stroke" /><title>{`${item.distance} км — ${formatPace(item.paceSeconds)} /км`}</title></g>)}
        </svg>
      )}
    </div>
  );
}
