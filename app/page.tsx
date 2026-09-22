'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Download, Pencil, Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Split = { id: number; km: string; time: string; pace: string };
type FavoriteSet = { id: string; name: string; splits: Split[] };

const initialSplits: Split[] = [
  { id: 1, km: '1', time: '04:38', pace: '04:38' },
  { id: 2, km: '5', time: '22:42', pace: '04:31' },
  { id: 3, km: '10', time: '46:22', pace: '04:44' },
  { id: 4, km: '15', time: '1:11:52', pace: '05:06' },
  { id: 5, km: '20', time: '1:35:57', pace: '04:49' },
  { id: 6, km: '21.1', time: '1:41:13', pace: '04:47' },
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

function addCalculatedPointTimes(splits: Array<Omit<Split, 'time'> & { time?: string }>): Split[] {
  let previousDistance = 0;
  let cumulativeSeconds = 0;
  return splits.map((split) => {
    const distance = Number(split.km.replace(',', '.'));
    const paceSeconds = paceToSeconds(split.pace);
    const segmentDistance = Number.isFinite(distance) ? Math.max(0, distance - previousDistance) : 0;
    cumulativeSeconds += segmentDistance * paceSeconds;
    if (Number.isFinite(distance) && distance > 0) previousDistance = distance;
    return { ...split, time: split.time?.trim() || formatElapsed(cumulativeSeconds) };
  });
}

type ChartPoint = { x: number; y: number };

function smoothSvgPath(points: ChartPoint[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlOne = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const controlTwo = { x: next.x - (afterNext.x - current.x) / 6, y: next.y - (afterNext.y - current.y) / 6 };
    path += ` C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function traceSmoothCanvas(ctx: CanvasRenderingContext2D, points: ChartPoint[]) {
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) return;
  ctx.lineTo(points[1].x, points[1].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    ctx.bezierCurveTo(
      current.x + (next.x - previous.x) / 6,
      current.y + (next.y - previous.y) / 6,
      next.x - (afterNext.x - current.x) / 6,
      next.y - (afterNext.y - current.y) / 6,
      next.x,
      next.y,
    );
  }
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default function Home() {
  const [runnerName, setRunnerName] = useState('Валерия Димитрова');
  const [draftName, setDraftName] = useState(runnerName);
  const [editingName, setEditingName] = useState(false);
  const [splits, setSplits] = useState<Split[]>(initialSplits);
  const [manualTotal, setManualTotal] = useState<string | null>(null);
  const [draftTotal, setDraftTotal] = useState('');
  const [editingTotal, setEditingTotal] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteSet[]>([]);
  const [activeFavoriteId, setActiveFavoriteId] = useState<string | null>(null);
  const [favoriteName, setFavoriteName] = useState('');
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);

  useEffect(() => {
    fetch('/api/favorites')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { favorites: Array<Omit<FavoriteSet, 'splits'> & { splits: Array<Omit<Split, 'time'> & { time?: string }> }> }) => {
        setFavorites(data.favorites.map((favorite) => ({ ...favorite, splits: addCalculatedPointTimes(favorite.splits) })));
      })
      .catch(() => setFavorites([]))
      .finally(() => setFavoritesReady(true));
  }, []);

  useEffect(() => {
    if (!activeFavoriteId || !favoritesReady) return;
    const timer = window.setTimeout(async () => {
      const active = favorites.find((favorite) => favorite.id === activeFavoriteId);
      if (!active) return;
      await fetch('/api/favorites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeFavoriteId, name: active.name, splits }),
      });
      setFavorites((current) => current.map((favorite) => favorite.id === activeFavoriteId ? { ...favorite, splits } : favorite));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeFavoriteId, favoritesReady, splits]);

  const parsed = useMemo(() => splits.map((split) => ({
    ...split,
    distance: Number(split.km.replace(',', '.')),
    paceSeconds: paceToSeconds(split.pace),
  })).filter((split) => split.distance > 0 && split.paceSeconds > 0).sort((a, b) => a.distance - b.distance), [splits]);

  const graphSplits = useMemo(
    () => parsed.filter((split) => Math.abs(split.distance - 21.1) >= 0.001),
    [parsed],
  );

  const timedSplits = useMemo(() => {
    let previousDistance = 0;
    let previousPointSeconds = 0;
    return parsed.map((split) => {
      const segmentDistance = Math.max(0, split.distance - previousDistance);
      const calculatedSegmentSeconds = segmentDistance * split.paceSeconds;
      const enteredPointSeconds = durationToSeconds(split.time);
      const cumulativeSeconds = enteredPointSeconds > previousPointSeconds
        ? enteredPointSeconds
        : previousPointSeconds + calculatedSegmentSeconds;
      const segmentSeconds = cumulativeSeconds - previousPointSeconds;
      previousDistance = split.distance;
      previousPointSeconds = cumulativeSeconds;
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

  const updateSplit = (id: number, key: 'km' | 'time' | 'pace', value: string) => {
    setSplits((current) => current.map((split) => split.id === id ? { ...split, [key]: value } : split));
  };

  const addSplit = () => {
    const last = parsed.at(-1);
    const lastTimed = timedSplits.at(-1);
    const nextDistance = last ? Math.round((last.distance + 1) * 10) / 10 : 1;
    const nextPace = last ? formatPace(last.paceSeconds) : '05:00';
    const nextPointSeconds = (lastTimed?.cumulativeSeconds ?? 0) + Math.max(0, nextDistance - (last?.distance ?? 0)) * paceToSeconds(nextPace);
    setSplits((current) => [...current, {
      id: Date.now(),
      km: String(nextDistance),
      time: formatElapsed(nextPointSeconds),
      pace: nextPace,
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

  const saveFavorite = async () => {
    if (!splits.length) return;
    setSavingFavorite(true);
    const name = favoriteName.trim() || `Набор ${favorites.length + 1}`;
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, splits }),
      });
      if (!response.ok) return;
      const data = await response.json() as { favorite: FavoriteSet };
      setFavorites((current) => [...current, data.favorite]);
      setActiveFavoriteId(data.favorite.id);
      setFavoriteName('');
    } finally {
      setSavingFavorite(false);
    }
  };

  const loadFavorite = (id: string) => {
    const favorite = favorites.find((item) => item.id === id);
    setActiveFavoriteId(id || null);
    if (!favorite) return;
    setSplits(addCalculatedPointTimes(favorite.splits));
    setManualTotal(null);
  };

  const exportPng = async () => {
    await document.fonts.ready;
    const logo = await loadCanvasImage('/mm-logo.svg').catch(() => null);
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const margin = 64;
    const contentWidth = width - margin * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = '#171813';
    ctx.textAlign = 'left';

    let nameSize = 52;
    do {
      ctx.font = `800 ${nameSize}px Manrope, Arial`;
      if (ctx.measureText(runnerName).width <= contentWidth) break;
      nameSize -= 2;
    } while (nameSize > 30);
    ctx.fillText(runnerName, margin, 112);

    const metricWidth = contentWidth / 3;
    const logoY = 54;
    const logoHeight = logo ? metricWidth * (logo.naturalHeight / logo.naturalWidth) : 0;
    if (logo) ctx.drawImage(logo, width - margin - metricWidth, logoY, metricWidth, logoHeight);

    const metricsY = Math.max(146, logoY + logoHeight + 46);
    const metricsHeight = 112;
    const metrics = [
      ['Общее время', formatDuration(summary.totalSeconds)],
      ['Средний темп', `${formatPace(summary.average)} /км`],
      ['Дистанция', `${summary.distance.toLocaleString('ru-RU')} км`],
    ];
    ctx.textBaseline = 'top';
    metrics.forEach(([label, value], index) => {
      const x = margin + metricWidth * index;
      ctx.fillStyle = '#f4f4f4';
      ctx.beginPath();
      if (index === 0) ctx.roundRect(x, metricsY, metricWidth, metricsHeight, [22, 0, 0, 22]);
      else if (index === 2) ctx.roundRect(x, metricsY, metricWidth, metricsHeight, [0, 22, 22, 0]);
      else ctx.rect(x, metricsY, metricWidth, metricsHeight);
      ctx.fill();
      ctx.fillStyle = 'rgba(23,24,19,.5)';
      ctx.font = '700 14px Manrope, Arial';
      ctx.fillText(label, x + 24, metricsY + 24);
      ctx.fillStyle = '#171813';
      ctx.font = '700 27px Manrope, Arial';
      ctx.fillText(value, x + 24, metricsY + 52);
    });
    ctx.strokeStyle = 'rgba(23,24,19,.12)';
    ctx.lineWidth = 1;
    [1, 2].forEach((index) => {
      const separatorX = margin + metricWidth * index;
      ctx.beginPath();
      ctx.moveTo(separatorX, metricsY + 20);
      ctx.lineTo(separatorX, metricsY + metricsHeight - 20);
      ctx.stroke();
    });
    ctx.textBaseline = 'alphabetic';

    const wideSectionX = margin + 8;
    const wideSectionWidth = width - wideSectionX - (margin + 4);
    const tableY = metricsY + metricsHeight + 6;
    const rowHeight = Math.max(22, Math.min(60, 500 / Math.max(timedSplits.length, 1)));
    const tableTitleHeight = 72;
    const tableBottomPadding = 14;
    const headerTop = tableY + tableTitleHeight;
    const headerHeight = 46;
    const tableHeight = tableTitleHeight + headerHeight + timedSplits.length * rowHeight + tableBottomPadding;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(wideSectionX, tableY, wideSectionWidth, tableHeight, 22);
    ctx.fill();
    ctx.fillStyle = '#171813';
    ctx.font = '800 26px Manrope, Arial';
    ctx.textBaseline = 'top';
    ctx.fillText('Время на точках', wideSectionX, tableY + 26);
    ctx.textBaseline = 'alphabetic';

    const columns = [
      wideSectionX,
      wideSectionX + wideSectionWidth * 0.34,
      wideSectionX + wideSectionWidth * 0.58,
      wideSectionX + wideSectionWidth * 0.79,
    ];
    const headers = ['Промежуточная точка', 'Время на точке', 'Время за участок', 'Темп на участке'];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(wideSectionX, headerTop, wideSectionWidth, headerHeight);
    ctx.fillStyle = 'rgba(23,24,19,.72)';
    ctx.font = '700 18px Manrope, Arial';
    headers.forEach((header, index) => ctx.fillText(header, columns[index], headerTop + 29));

    const rowFont = Math.max(16, Math.min(22, rowHeight * 0.44));
    timedSplits.forEach((split, index) => {
      const y = headerTop + headerHeight + rowHeight * index;
      if (index % 2 === 1) {
        ctx.fillStyle = '#f4f4f4';
        ctx.fillRect(wideSectionX, y, wideSectionWidth, rowHeight);
      }
      if (index > 0) {
        ctx.strokeStyle = 'rgba(23,24,19,.09)';
        ctx.beginPath();
        ctx.moveTo(wideSectionX, y);
        ctx.lineTo(wideSectionX + wideSectionWidth, y);
        ctx.stroke();
      }
      ctx.font = `600 ${rowFont}px Manrope, Arial`;
      ctx.fillStyle = '#171813';
      ctx.fillText(`${split.distance.toLocaleString('ru-RU')} км`, columns[0] + 5, y + rowHeight * 0.68);
      ctx.fillStyle = 'rgba(23,24,19,.65)';
      ctx.fillText(formatElapsed(split.cumulativeSeconds), columns[1], y + rowHeight * 0.68);
      ctx.fillText(formatElapsed(split.segmentSeconds), columns[2], y + rowHeight * 0.68);
      ctx.fillStyle = '#171813';
      ctx.fillText(`${formatPace(split.paceSeconds)} /км`, columns[3], y + rowHeight * 0.68);
    });

    const graphY = tableY + tableHeight + 4;
    const graphHeight = Math.max(190, Math.min(320, height - graphY - 72));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(wideSectionX, graphY, wideSectionWidth, graphHeight, 22);
    ctx.fill();
    ctx.fillStyle = '#171813';
    ctx.font = '800 26px Manrope, Arial';
    ctx.textBaseline = 'top';
    ctx.fillText('Темп по дистанции', wideSectionX, graphY + 26);
    ctx.textBaseline = 'alphabetic';

    const graphRight = wideSectionX + wideSectionWidth - 12;
    const legendY = graphY + 49;
    const legendX = graphRight - 252;
    ctx.fillStyle = '#e20921';
    ctx.beginPath();
    ctx.arc(legendX, legendY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(23,24,19,.62)';
    ctx.font = '600 19px Manrope, Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText('Темп', legendX + 13, legendY);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(23,24,19,.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(legendX + 88, legendY);
    ctx.lineTo(legendX + 118, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('Средний темп', legendX + 128, legendY);
    ctx.textBaseline = 'alphabetic';

    if (graphSplits.length) {
      const graphTitleX = wideSectionX;
      const graph = { left: wideSectionX + 52, top: graphY + 96, right: graphRight, bottom: graphY + graphHeight - 56 };
      const graphData = [{ ...graphSplits[0], distance: 0 }, ...graphSplits];
      const paces = graphData.map((item) => item.paceSeconds);
      const minPace = Math.floor((Math.min(...paces, summary.average) - 15) / 10) * 10;
      const maxPace = Math.ceil((Math.max(...paces, summary.average) + 15) / 10) * 10;
      const maxDistance = Math.max(...graphSplits.map((item) => item.distance));
      const x = (distance: number) => graph.left + (distance / maxDistance) * (graph.right - graph.left);
      const y = (pace: number) => graph.top + ((pace - minPace) / Math.max(1, maxPace - minPace)) * (graph.bottom - graph.top);

      for (let index = 0; index < 5; index += 1) {
        const tick = minPace + ((maxPace - minPace) / 4) * index;
        ctx.strokeStyle = 'rgba(23,24,19,.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(graph.left, y(tick));
        ctx.lineTo(graph.right, y(tick));
        ctx.stroke();
        ctx.fillStyle = 'rgba(23,24,19,.5)';
        ctx.font = '600 18px Manrope, Arial';
        ctx.textAlign = 'left';
        ctx.fillText(formatPace(tick), graphTitleX, y(tick) + 4);
      }

      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(23,24,19,.5)';
      ctx.beginPath();
      ctx.moveTo(graph.left, y(summary.average));
      ctx.lineTo(graph.right, y(summary.average));
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#e20921';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const curvePoints = graphData.map((item) => ({ x: x(item.distance), y: y(item.paceSeconds) }));
      ctx.beginPath();
      traceSmoothCanvas(ctx, curvePoints);
      ctx.stroke();

      const labelRightEdges = [-Infinity, -Infinity];
      graphData.forEach((item, index) => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#e20921';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x(item.distance), y(item.paceSeconds), 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (
          Math.abs(item.distance) < 0.001 ||
          Math.abs(item.distance - maxDistance) < 0.001
        ) return;
        const distanceLabel = `${item.distance.toLocaleString('ru-RU')} км`;
        ctx.font = `600 ${graphData.length > 10 ? 15 : 17}px Manrope, Arial`;
        const labelWidth = ctx.measureText(distanceLabel).width;
        const labelLeft = x(item.distance) - labelWidth / 2;
        const firstFreeRow = labelRightEdges.findIndex((rightEdge) => labelLeft > rightEdge + 5);
        const labelRow = firstFreeRow === -1 ? index % 2 : firstFreeRow;
        labelRightEdges[labelRow] = x(item.distance) + labelWidth / 2;
        ctx.fillStyle = 'rgba(23,24,19,.5)';
        ctx.textAlign = 'center';
        ctx.fillText(distanceLabel, x(item.distance), graph.bottom + 24 + labelRow * 18);
      });
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = 'rgba(23,24,19,.55)';
    ctx.font = `700 ${rowFont}px Manrope, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('SHELGORN', width / 2, height - 34);
    ctx.textAlign = 'left';

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${runnerName.toLowerCase().replaceAll(' ', '-')}-splitpace.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <main className="min-h-screen bg-[#f3f3ef] text-[#171813]">
      <header className="border-b border-black/10 bg-[#f3f3ef]/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <span className="text-sm font-medium text-black/60">Результат забега</span>
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-full bg-[#e20921] text-[10px] font-black text-white">SP</span>
            SPLITPACE
          </div>
          <Button onClick={exportPng} variant="outline" size="sm" className="rounded-full border-black/15 bg-transparent px-3">
            <Download /> <span className="hidden sm:inline">PNG 4:5</span>
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

        <div className="grid items-start gap-5 xl:grid-cols-[500px_minmax(0,1fr)]">
          <section className="rounded-[22px] border border-black/10 bg-white p-5 sm:p-6" aria-labelledby="splits-heading">
            <div className="mb-5 flex items-start justify-between">
              <div><h2 id="splits-heading" className="text-xl font-bold tracking-tight">Сплиты</h2><p className="mt-1 text-sm text-black/45">Дистанция и темп на участке</p></div>
              <Button variant="ghost" size="icon-sm" onClick={() => { setSplits(initialSplits); setManualTotal(null); }} className="rounded-full text-black/45 hover:text-black" aria-label="Вернуть исходные значения"><RotateCcw /></Button>
            </div>
            <div className="mb-5 rounded-xl bg-[#fdecee] p-3.5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Star className="size-4 fill-[#e20921] text-[#e20921]" /> Избранное</div>
              {favorites.length > 0 && (
                <select
                  value={activeFavoriteId ?? ''}
                  onChange={(event) => loadFavorite(event.target.value)}
                  className="mb-2 h-10 w-full rounded-lg border border-black/10 bg-white px-3 text-sm font-medium outline-none transition focus:border-[#e20921]"
                  aria-label="Выбрать сохранённый набор сплитов"
                >
                  <option value="">Выберите сохранённый набор</option>
                  {favorites.map((favorite) => <option key={favorite.id} value={favorite.id}>{favorite.name} · {favorite.splits.length}</option>)}
                </select>
              )}
              <div className="flex gap-2">
                <Input value={favoriteName} onChange={(event) => setFavoriteName(event.target.value)} placeholder="Название набора" className="h-10 border-0 bg-white shadow-none focus-visible:ring-2" aria-label="Название нового избранного набора" />
                <Button onClick={saveFavorite} disabled={savingFavorite || !favoritesReady} className="h-10 shrink-0 rounded-lg bg-[#171813] px-3"><Star /> {savingFavorite ? 'Сохраняю' : 'Сохранить'}</Button>
              </div>
              {activeFavoriteId && <p className="mt-2 text-xs text-black/45">Изменения темпа сохраняются в выбранный набор автоматически.</p>}
            </div>
            <div className="mb-2 grid grid-cols-[1fr_1.15fr_1.05fr_58px] gap-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-black/35"><span>Километр</span><span>Время на точке</span><span>Темп /км</span><span /></div>
            <div className="space-y-2">
              {splits.map((split, index) => (
                <div key={split.id} className="group grid grid-cols-[1fr_1.15fr_1.05fr_58px] items-center gap-2 rounded-xl bg-[#f4f4f0] p-2 transition focus-within:bg-[#efefe9]">
                  <label className="flex items-center gap-1.5">
                    <span className="w-5 text-center text-xs font-semibold text-black/30">{index + 1}</span>
                    <Input inputMode="decimal" value={split.km} onChange={(event) => updateSplit(split.id, 'km', event.target.value)} className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Дистанция сплита ${index + 1} в километрах`} />
                  </label>
                  <Input value={split.time} onChange={(event) => updateSplit(split.id, 'time', event.target.value)} placeholder="00:00" className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Время на точке сплита ${index + 1}`} />
                  <Input value={split.pace} onChange={(event) => updateSplit(split.id, 'pace', event.target.value)} placeholder="05:00" className="h-9 rounded-lg border-0 bg-white px-2.5 font-semibold shadow-none focus-visible:ring-2" aria-label={`Темп сплита ${index + 1}`} />
                  <div className="flex items-center justify-end gap-0.5">
                    <div className="flex flex-col">
                      <button disabled={index === 0} onClick={() => moveSplit(index, -1)} className="grid size-5 place-items-center rounded text-black/35 transition hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-20" aria-label={`Переместить сплит ${index + 1} выше`}><ChevronUp className="size-3.5" /></button>
                      <button disabled={index === splits.length - 1} onClick={() => moveSplit(index, 1)} className="grid size-5 place-items-center rounded text-black/35 transition hover:bg-white hover:text-black disabled:pointer-events-none disabled:opacity-20" aria-label={`Переместить сплит ${index + 1} ниже`}><ChevronDown className="size-3.5" /></button>
                    </div>
                    <button onClick={() => setSplits((current) => current.filter((item) => item.id !== split.id))} className="grid size-8 place-items-center rounded-lg text-black/25 transition hover:bg-[#fbe7ea] hover:text-[#b5081c]" aria-label={`Удалить сплит ${index + 1}`}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={addSplit} variant="outline" className="mt-4 h-10 w-full rounded-xl border-dashed border-black/20 bg-transparent text-black/65 hover:bg-[#f4f4f0]"><Plus /> Добавить сплит</Button>
          </section>

          <div className="min-w-0 space-y-5 xl:self-start">
            <section className="grid overflow-hidden rounded-[22px] border border-black/10 bg-white text-[#171813] sm:grid-cols-3" aria-label="Итоговые показатели">
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
              <div className="border-b border-black/10 px-5 py-5 sm:px-7">
                <h2 id="timing-heading" className="text-xl font-bold tracking-tight sm:text-2xl">Время на точках</h2>
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
                  <span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#e20921]" /> Темп</span>
                  <span className="flex items-center gap-2"><i className="h-px w-5 border-t border-dashed border-black/50" /> Средний темп</span>
                </div>
              </div>
              <PaceChart data={graphSplits} average={summary.average} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={`min-w-0 p-5 sm:p-7 ${accent ? 'bg-[#fdecee]' : 'border-black/10 sm:border-r last:border-r-0'}`}><p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{label}</p><p className="mt-3 truncate text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{value}</p><p className="mt-2 text-xs text-black/45">{detail}</p></div>;
}

function TotalMetric({ value, adjusted, editing, draft, onDraftChange, onEdit, onSave, onReset }: { value: string; adjusted: boolean; editing: boolean; draft: string; onDraftChange: (value: string) => void; onEdit: () => void; onSave: () => void; onReset: () => void }) {
  return (
    <div className="min-w-0 border-black/10 p-5 sm:border-r sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Общее время</p>
      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <Input autoFocus value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSave()} className="h-10 min-w-0 rounded-lg border-black/15 bg-black/[0.04] px-2 text-xl font-semibold text-[#171813] shadow-none focus-visible:border-black/35 focus-visible:ring-black/10" aria-label="Общее время в формате часы минуты секунды" />
          <button onClick={onSave} className="grid size-9 shrink-0 place-items-center rounded-full bg-[#171813] text-white" aria-label="Сохранить общее время"><Check className="size-4" /></button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <p className="truncate text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{value}</p>
          <button onClick={onEdit} className="grid size-8 shrink-0 place-items-center rounded-full border border-black/15 text-black/50 transition hover:bg-black/[0.04] hover:text-black" aria-label="Редактировать общее время"><Pencil className="size-3.5" /></button>
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-black/45">
        <span>{adjusted ? 'скорректировано вручную' : 'расчёт по сплитам'}</span>
        {adjusted && <button onClick={onReset} className="underline decoration-black/25 underline-offset-2 transition hover:text-black" aria-label="Вернуть расчётное общее время">Сбросить</button>}
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
  const chartPoints = chartData.map((item) => ({ x: x(item.distance), y: y(item.paceSeconds) }));
  const linePath = smoothSvgPath(chartPoints);
  const ticks = Array.from({ length: 5 }, (_, index) => minPace + ((maxPace - minPace) / 4) * index);
  const areaPath = chartData.length ? `${linePath} L ${x(maxDistance)} ${padding.top + chartHeight} L ${x(0)} ${padding.top + chartHeight} Z` : '';

  return (
    <div className="mt-7 h-[310px] overflow-hidden sm:h-[340px]" role="img" aria-label="График изменения темпа по дистанции">
      {data.length < 1 ? <div className="grid h-full place-items-center rounded-2xl border border-dashed border-black/15 text-center text-sm text-black/40">Добавьте корректный сплит,<br />чтобы увидеть график.</div> : (
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
          <defs><linearGradient id="paceArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e20921" stopOpacity="0.18" /><stop offset="100%" stopColor="#e20921" stopOpacity="0" /></linearGradient></defs>
          {ticks.map((tick) => <g key={tick}><line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} stroke="#171813" strokeOpacity="0.09" /><text x={padding.left - 12} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#171813" fillOpacity="0.45">{formatPace(tick)}</text></g>)}
          {chartData.map((item) => <g key={`axis-${item.id}`}><line x1={x(item.distance)} x2={x(item.distance)} y1={padding.top} y2={padding.top + chartHeight} stroke="#171813" strokeOpacity="0.045" /><text x={x(item.distance)} y={height - 30} textAnchor="middle" fontSize="11" fill="#171813" fillOpacity="0.5">{item.distance} км</text></g>)}
          <text x={padding.left + chartWidth / 2} y={height - 5} textAnchor="middle" fontSize="11" fontWeight="600" fill="#171813" fillOpacity="0.48">Дистанция, км</text>
          <text x="15" y={padding.top + chartHeight / 2} textAnchor="middle" fontSize="11" fontWeight="600" fill="#171813" fillOpacity="0.48" transform={`rotate(-90 15 ${padding.top + chartHeight / 2})`}>Темп, мин/км</text>
          <path d={areaPath} fill="url(#paceArea)" />
          <line x1={padding.left} x2={width - padding.right} y1={y(average)} y2={y(average)} stroke="#171813" strokeOpacity="0.5" strokeDasharray="6 6" />
          <path d={linePath} fill="none" stroke="#e20921" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {chartData.map((item) => <g key={`point-${item.id}`}><circle cx={x(item.distance)} cy={y(item.paceSeconds)} r="7" fill="white" stroke="#e20921" strokeWidth="3" vectorEffect="non-scaling-stroke" /><title>{`${item.distance} км — ${formatPace(item.paceSeconds)} /км`}</title></g>)}
        </svg>
      )}
    </div>
  );
}
