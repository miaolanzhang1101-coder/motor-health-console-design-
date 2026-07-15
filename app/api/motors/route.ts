import { NextResponse } from 'next/server';
import { generateSampleFleet } from '../../../lib/sampleData';

export async function GET() {
  try {
    const motors = generateSampleFleet();
    return NextResponse.json({ motors });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate fleet' }, { status: 500 });
  }
}