import { NextResponse } from 'next/server';
import { appendLiveWindow } from '../../../../lib/liveStream';
import { Motor } from '../../../../lib/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const motor = body.motor as Motor;
    if (!motor || !motor.file) {
      return NextResponse.json({ error: 'Missing motor in request body' }, { status: 400 });
    }
    const updated = appendLiveWindow(motor);
    return NextResponse.json({ motor: updated });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate next window' }, { status: 500 });
  }
}