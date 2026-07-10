import { NextResponse } from 'next/server';
import { getLegalConfig, saveLegalConfig } from '../../../../lib/legal-config';

export async function GET() {
  try {
    return NextResponse.json(await getLegalConfig());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to load legal config.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { disclaimer?: string; serviceTerms?: string; version?: string };
    await saveLegalConfig({
      disclaimer: body.disclaimer?.trim() ?? '',
      serviceTerms: body.serviceTerms?.trim() ?? '',
      version: body.version?.trim() || '1'
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Failed to save legal config.' }, { status: 500 });
  }
}
