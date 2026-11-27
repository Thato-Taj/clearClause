import type { Metadata } from 'next';
import { AccountView } from './AccountView';

export const metadata: Metadata = { title: 'Account' };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <AccountView />
    </div>
  );
}
