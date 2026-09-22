import { createFavorite, listFavorites, updateFavorite } from '@/db/favorites';

type Split = { id: number; km: string; pace: string };

function validSplits(value: unknown): value is Split[] {
  return Array.isArray(value) && value.length <= 100 && value.every((split) => {
    if (!split || typeof split !== 'object') return false;
    const candidate = split as Record<string, unknown>;
    return typeof candidate.id === 'number' && typeof candidate.km === 'string' && typeof candidate.pace === 'string';
  });
}

export async function GET() {
  return Response.json({ favorites: await listFavorites() });
}

export async function POST(request: Request) {
  const body = await request.json() as { name?: unknown; splits?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!name || !validSplits(body.splits)) return Response.json({ error: 'Некорректный набор сплитов' }, { status: 400 });
  return Response.json({ favorite: await createFavorite(name, body.splits) }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json() as { id?: unknown; name?: unknown; splits?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  if (!id || !name || !validSplits(body.splits)) return Response.json({ error: 'Некорректный набор сплитов' }, { status: 400 });
  return Response.json({ favorite: await updateFavorite(id, name, body.splits) });
}
