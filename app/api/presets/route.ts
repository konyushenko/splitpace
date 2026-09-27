import { createPreset, listPresets, updatePreset } from '@/db/presets';

// D1 rows are capped at 2 MB; the logo is stored inline as a data URL.
const maxLogoLength = 1_500_000;

function validStyle(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const style = value as Record<string, unknown>;
  const isRecord = (item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object';
  return isRecord(style.colors) && Object.values(style.colors).every((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color))
    && isRecord(style.opacity) && Object.values(style.opacity).every((item) => typeof item === 'number' && item >= 0 && item <= 100)
    && typeof style.logoHeight === 'number'
    && typeof style.nameOffset === 'number'
    && typeof style.logoUrl === 'string'
    && style.logoUrl.length <= maxLogoLength
    && (style.logoUrl === '/mm-logo.svg' || /^data:image\/(svg\+xml|png|webp);base64,/.test(style.logoUrl));
}

export async function GET() {
  return Response.json({ presets: await listPresets() });
}

export async function POST(request: Request) {
  const body = await request.json() as { name?: unknown; style?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name || !validStyle(body.style)) return Response.json({ error: 'Некорректный пресет' }, { status: 400 });
  return Response.json({ preset: await createPreset(name, body.style) }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json() as { id?: unknown; style?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id || !validStyle(body.style)) return Response.json({ error: 'Некорректный пресет' }, { status: 400 });
  await updatePreset(id, body.style);
  return Response.json({ ok: true });
}
