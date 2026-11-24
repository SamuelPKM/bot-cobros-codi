'use server';

import { redirect } from 'next/navigation';
import { endSession } from '../services/session.service';

export async function logout(): Promise<void> {
  await endSession();
  redirect('/entrar');
}
