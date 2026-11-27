import type { Metadata } from 'next';
import { ReportList } from './ReportList';

export const metadata: Metadata = { title: 'My reports' };

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <ReportList />
    </div>
  );
}
