import { NextResponse } from 'next/server';

export async function GET() {
  const tracks = [
    { id: 1, title: 'Первый трек', artist: 'Sonatum', duration: '3:45' },
    { id: 2, title: 'Второй трек', artist: 'Sonatum', duration: '4:20' },
    { id: 3, title: 'Третий трек', artist: 'Sonatum', duration: '3:15' }
  ];
  
  return NextResponse.json({ tracks });
}
