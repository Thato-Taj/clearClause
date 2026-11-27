import type { Metadata } from 'next';
import { SavedReport } from './SavedReport';

export const metadata: Metadata = { title: 'Report' };

export default async function ReportPage(props: PageProps<'/reports/[id]'>) {
  const { id } = await props.params;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <SavedReport id={id} />
    </div>
  );
}
